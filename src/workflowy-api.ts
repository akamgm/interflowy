export interface WorkflowyNode {
  id: string;
  name: string;
  parent_id?: string | null;
}

export interface WorkflowyTarget {
  key: string;
  type: "shortcut" | "system";
  name: string | null;
  /** Parent node name, resolved only when another target shares this one's name. */
  parentName?: string;
}

/** Display name for a target, qualified by its parent when the name is ambiguous. */
export function targetLabel(target: WorkflowyTarget): string {
  const name = target.name ?? target.key;
  return target.parentName ? `${name} (${target.parentName})` : name;
}

function stripHtml(name: string): string {
  return name.replace(/<[^>]*>/g, "").trim();
}

/**
 * Simple client for Workflowy's new official API
 */
export class WorkflowyClient {
  private apiKey: string;
  private baseUrl = "https://workflowy.com/api/v1";

  constructor(apiKey: string) {
    this.apiKey = apiKey
      .trim()
      .replace(/^sessionid=/, "")
      .trim();
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * List available targets from the Workflowy API
   */
  async listTargets(): Promise<WorkflowyTarget[]> {
    const response = await fetch(`${this.baseUrl}/targets/`, {
      headers: this.headers,
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Invalid Workflowy API Key. Please check your extension preferences.");
      }
      throw new Error(`Workflowy API returned ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as { targets: WorkflowyTarget[] };
    const targets = (data.targets || [])
      .filter((t) => t.name !== null)
      .map((t) => ({ ...t, name: stripHtml(t.name!) || t.key }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "system" ? -1 : 1;
        return a.name!.localeCompare(b.name!);
      });

    return this.qualifyDuplicateNames(targets);
  }

  /**
   * Different nodes can share a name, which makes the targets indistinguishable
   * in a list. Tag only the colliding ones with their parent's name.
   */
  private async qualifyDuplicateNames(targets: WorkflowyTarget[]): Promise<WorkflowyTarget[]> {
    const counts = new Map<string, number>();
    for (const target of targets) {
      counts.set(target.name!, (counts.get(target.name!) ?? 0) + 1);
    }

    const ambiguous = targets.filter((t) => (counts.get(t.name!) ?? 0) > 1);
    if (ambiguous.length === 0) return targets;

    const parentNames = await Promise.all(
      ambiguous.map((t) => this.getParentName(t.key).catch(() => null)),
    );
    const byKey = new Map(ambiguous.map((t, i) => [t.key, parentNames[i]]));

    return targets.map((target) => {
      const parentName = byKey.get(target.key);
      return parentName ? { ...target, parentName } : target;
    });
  }

  /**
   * Name of the parent of the node a target points at, or null if it cannot be
   * resolved (an unreachable target, or a target sitting at the top level).
   */
  async getParentName(targetKey: string): Promise<string | null> {
    const node = await this.resolveTarget(targetKey);
    if (!node?.parent_id) return null;

    const parent = await this.getNode(node.parent_id);
    if (!parent) return null;

    return stripHtml(parent.name) || null;
  }

  /**
   * Resolves a target key to its node. Keys are not node ids in general, so fall
   * back to reading the parent_id off one of the target's children.
   */
  private async resolveTarget(targetKey: string): Promise<WorkflowyNode | null> {
    const direct = await this.getNode(targetKey);
    if (direct) return direct;

    const [firstChild] = await this.listChildren(targetKey);
    return firstChild?.parent_id ? this.getNode(firstChild.parent_id) : null;
  }

  /**
   * Fetches a single node. Returns null when the id is not resolvable.
   */
  async getNode(id: string): Promise<WorkflowyNode | null> {
    const response = await fetch(`${this.baseUrl}/nodes/${encodeURIComponent(id)}`, {
      headers: this.headers,
    });

    if (!response.ok) return null;

    const data = (await response.json()) as { node?: WorkflowyNode };
    return data.node ?? null;
  }

  /**
   * Lists the children of a node or target key.
   */
  async listChildren(parentId: string): Promise<WorkflowyNode[]> {
    const response = await fetch(
      `${this.baseUrl}/nodes?parent_id=${encodeURIComponent(parentId)}`,
      { headers: this.headers },
    );

    if (!response.ok) return [];

    const data = (await response.json()) as { nodes?: WorkflowyNode[] };
    return data.nodes || [];
  }

  /**
   * Search for a list (node) by its name pattern
   */
  async findNodeByName(pattern: string): Promise<WorkflowyNode | null> {
    const regex = new RegExp(pattern, "i");
    const queue: (string | null)[] = [null]; // null represents the root

    while (queue.length > 0) {
      const parentId = queue.shift();
      const url = parentId
        ? `${this.baseUrl}/nodes?parent_id=${parentId}`
        : `${this.baseUrl}/nodes`;

      const response = await fetch(url, { headers: this.headers });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error(
            "Invalid Workflowy API Key. Please check your extension preferences.",
          );
        }
        throw new Error(
          `Workflowy API returned ${response.status}: ${response.statusText}`,
        );
      }

      const data = (await response.json()) as { nodes: WorkflowyNode[] };
      const nodes = data.nodes || [];

      for (const node of nodes) {
        // Strip HTML formatting that Workflowy might include in node names
        const cleanName = node.name.replace(/<[^>]*>/g, "").trim();

        if (regex.test(cleanName)) {
          return node;
        }

        // Push children to be searched
        queue.push(node.id);
      }
    }

    return null;
  }

  /**
   * Creates a new child node
   */
  async createNode(
    parentId: string,
    name: string,
    options: { note?: string; layoutMode?: string; position?: "top" | "bottom" } = {},
  ): Promise<string> {
    const { note, layoutMode, position = "bottom" } = options;
    const response = await fetch(`${this.baseUrl}/nodes/`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        parent_id: parentId,
        name,
        position,
        ...(note ? { note } : {}),
        ...(layoutMode ? { layoutMode } : {}),
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to create node: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as { item_id: string };
    return data.item_id;
  }
}

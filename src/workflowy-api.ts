export interface WorkflowyNode {
  id: string;
  name: string;
}

export interface WorkflowyTarget {
  key: string;
  type: "shortcut" | "system";
  name: string | null;
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
    return (data.targets || [])
      .filter((t) => t.name !== null)
      .map((t) => ({ ...t, name: t.name!.replace(/<[^>]*>/g, "").trim() || t.key }));
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

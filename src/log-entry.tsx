import {
  Form,
  ActionPanel,
  Action,
  showToast,
  Toast,
  getPreferenceValues,
  openExtensionPreferences,
  Icon,
  closeMainWindow,
  LocalStorage,
} from "@raycast/api";
import { useState, useEffect } from "react";
import { WorkflowyClient, WorkflowyTarget } from "./workflowy-api";

interface Preferences {
  workflowyApiKey?: string;
  timestampFormat?: string;
  closeDelay?: string;
}

export default function Command() {
  const [isLoading, setIsLoading] = useState(false);
  const [text, setText] = useState("");
  const [targets, setTargets] = useState<WorkflowyTarget[]>([]);
  const [targetsLoading, setTargetsLoading] = useState(true);
  const [selectedTarget, setSelectedTarget] = useState<string>("");
  const preferences = getPreferenceValues<Preferences>();

  useEffect(() => {
    async function fetchTargets() {
      if (!preferences.workflowyApiKey) {
        setTargetsLoading(false);
        return;
      }
      try {
        const client = new WorkflowyClient(preferences.workflowyApiKey);
        const [fetchedTargets, lastTarget] = await Promise.all([
          client.listTargets(),
          LocalStorage.getItem<string>("lastTarget"),
        ]);
        setTargets(fetchedTargets);
        if (fetchedTargets.length > 0) {
          const defaultKey = lastTarget && fetchedTargets.some((t) => t.key === lastTarget)
            ? lastTarget
            : fetchedTargets[0].key;
          setSelectedTarget(defaultKey);
        }
      } catch (error) {
        await showToast({
          title: "Failed to load targets",
          message: error instanceof Error ? error.message : String(error),
          style: Toast.Style.Failure,
        });
      } finally {
        setTargetsLoading(false);
      }
    }
    fetchTargets();
  }, []);

  function handleTargetChange(key: string) {
    // Ignore selections for items that are not in the list (Raycast can emit
    // a stale or empty value while the list is being replaced).
    if (targets.some((t) => t.key === key)) {
      setSelectedTarget(key);
    }
  }

  async function handleSubmit(values: { text: string; target: string }) {
    if (!values.text) {
      showToast({
        title: "Please enter some text",
        style: Toast.Style.Failure,
      });
      return;
    }

    if (!preferences.workflowyApiKey) {
      showToast({
        title: "Missing preferences",
        message: "Please configure your Workflowy API key in extension preferences.",
        style: Toast.Style.Failure,
        primaryAction: {
          title: "Open Extension Preferences",
          onAction: () => {
            openExtensionPreferences();
          },
        },
      });
      return;
    }

    if (!values.target) {
      showToast({
        title: "No target selected",
        message: "Please select a target list.",
        style: Toast.Style.Failure,
      });
      return;
    }

    setIsLoading(true);
    const toast = await showToast({
      title: "Logging entry...",
      style: Toast.Style.Animated,
    });

    try {
      const client = new WorkflowyClient(preferences.workflowyApiKey);

      const is24h = preferences.timestampFormat === "24h";
      const timeStr = new Date().toLocaleTimeString([], {
        hour: is24h ? "2-digit" : "numeric",
        minute: "2-digit",
        hour12: !is24h,
      });
      const itemName = `**${timeStr}** ${values.text}`;

      await client.createNode(values.target, itemName);
      await LocalStorage.setItem("lastTarget", values.target);

      toast.style = Toast.Style.Success;
      toast.title = "Logged successfully";

      setText("");

      const delaySeconds = parseFloat(preferences.closeDelay || "2");
      const delayMs = (isNaN(delaySeconds) ? 2 : delaySeconds) * 1000;

      setTimeout(async () => {
        await closeMainWindow();
      }, delayMs);
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to log entry";
      toast.message = error instanceof Error ? error.message : String(error);
      toast.primaryAction = {
        title: "Open Extension Preferences",
        onAction: () => {
          openExtensionPreferences();
        },
      };
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form
      isLoading={isLoading || targetsLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Log Entry" onSubmit={handleSubmit} />
          <Action
            title="Open Extension Preferences"
            icon={Icon.Gear}
            onAction={openExtensionPreferences}
          />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="text"
        title="Journal Entry"
        placeholder="What's on your mind right now?"
        value={text}
        onChange={setText}
        autoFocus
      />
      {/* Mount only once the items and the restored default are both ready:
          a dropdown rendered with no items emits its own selection of the
          first item, which would overwrite the last-used target. */}
      {targets.length > 0 && selectedTarget ? (
        <Form.Dropdown
          id="target"
          title="Target List"
          value={selectedTarget}
          onChange={handleTargetChange}
        >
          {targets.map((target) => (
            <Form.Dropdown.Item key={target.key} value={target.key} title={target.name ?? target.key} keywords={[target.key]} />
          ))}
        </Form.Dropdown>
      ) : null}
    </Form>
  );
}

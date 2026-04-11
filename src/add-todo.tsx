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
  closeDelay?: string;
}

export default function Command() {
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
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
          LocalStorage.getItem<string>("lastTodoTarget"),
        ]);
        setTargets(fetchedTargets);
        if (fetchedTargets.length > 0) {
          const defaultKey =
            lastTarget && fetchedTargets.some((t) => t.key === lastTarget)
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

  async function handleSubmit(values: { title: string; note: string; target: string }) {
    if (!values.title) {
      showToast({
        title: "Please enter a title",
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
          onAction: () => openExtensionPreferences(),
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
      title: "Adding to-do...",
      style: Toast.Style.Animated,
    });

    try {
      const client = new WorkflowyClient(preferences.workflowyApiKey);

      await client.createNode(values.target, values.title, {
        note: values.note || undefined,
        layoutMode: "todo",
      });

      await LocalStorage.setItem("lastTodoTarget", values.target);

      toast.style = Toast.Style.Success;
      toast.title = "To-do added";

      setTitle("");
      setNote("");

      const delaySeconds = parseFloat(preferences.closeDelay || "2");
      const delayMs = (isNaN(delaySeconds) ? 2 : delaySeconds) * 1000;

      setTimeout(async () => {
        await closeMainWindow();
      }, delayMs);
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to add to-do";
      toast.message = error instanceof Error ? error.message : String(error);
      toast.primaryAction = {
        title: "Open Extension Preferences",
        onAction: () => openExtensionPreferences(),
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
          <Action.SubmitForm title="Add To-Do" onSubmit={handleSubmit} />
          <Action
            title="Open Extension Preferences"
            icon={Icon.Gear}
            onAction={openExtensionPreferences}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="title"
        title="To-Do"
        placeholder="What needs to be done?"
        value={title}
        onChange={setTitle}
        autoFocus
      />
      <Form.TextArea
        id="note"
        title="Note"
        placeholder="Optional details..."
        value={note}
        onChange={setNote}
      />
      <Form.Dropdown
        id="target"
        title="Target List"
        value={selectedTarget}
        onChange={setSelectedTarget}
      >
        {targets.map((target) => (
          <Form.Dropdown.Item key={target.key} value={target.key} title={target.name ?? target.key} />
        ))}
      </Form.Dropdown>
    </Form>
  );
}

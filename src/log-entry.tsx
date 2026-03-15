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
} from "@raycast/api";
import { useState } from "react";
import { WorkflowyClient } from "./workflowy-api";

interface Preferences {
  workflowyApiKey?: string;
  targetList?: string;
  timestampFormat?: string;
}

export default function Command() {
  const [isLoading, setIsLoading] = useState(false);
  const [text, setText] = useState("");
  const preferences = getPreferenceValues<Preferences>();

  async function handleSubmit(values: { text: string }) {
    if (!values.text) {
      showToast({
        title: "Please enter some text",
        style: Toast.Style.Failure,
      });
      return;
    }

    if (!preferences.workflowyApiKey || !preferences.targetList) {
      showToast({
        title: "Missing preferences",
        message:
          "Please configure your Workflowy API key in extension preferences.",
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

    setIsLoading(true);
    const toast = await showToast({
      title: "Logging entry...",
      style: Toast.Style.Animated,
    });

    try {
      const client = new WorkflowyClient(preferences.workflowyApiKey);
      const targetList = await client.findNodeByName(preferences.targetList);

      if (!targetList) {
        toast.style = Toast.Style.Failure;
        toast.title = "Target list not found";
        toast.message = `Could not find a list matching "${preferences.targetList}"`;
        toast.primaryAction = {
          title: "Open Extension Preferences",
          onAction: () => {
            openExtensionPreferences();
          },
        };
        setIsLoading(false);
        return;
      }

      // Get time in a short format
      const is24h = preferences.timestampFormat === "24h";
      const timeStr = new Date().toLocaleTimeString([], {
        hour: is24h ? "2-digit" : "numeric",
        minute: "2-digit",
        hour12: !is24h,
      });
      const itemName = `**${timeStr}** ${values.text}`;

      await client.createNode(targetList.id, itemName);

      toast.style = Toast.Style.Success;
      toast.title = "Logged successfully";

      // Clear the form after success
      setText("");

      setTimeout(async () => {
        await closeMainWindow();
      }, 2000);
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
      isLoading={isLoading}
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
    </Form>
  );
}

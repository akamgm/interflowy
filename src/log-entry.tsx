import {
  Form,
  ActionPanel,
  Action,
  showToast,
  Toast,
  getPreferenceValues,
  openExtensionPreferences,
  Icon,
} from "@raycast/api";
import { WorkFlowy } from "workflowy";
import { useState } from "react";

interface Preferences {
  workflowyApiKey?: string;
  targetList?: string;
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
      const workflowy = new WorkFlowy("", "");
      const client = workflowy.getClient();

      // Handle case where user accidentally includes "sessionid=" prefix
      const apiKey = preferences.workflowyApiKey
        .trim()
        .replace(/^sessionid=/, "")
        .trim();
      client.sessionHeaders.set("Cookie", `sessionid=${apiKey}`);

      // Prevent fallback to email/password login if cookie is invalid
      client.login = async () => {
        throw new Error(
          "Invalid Workflowy API Key. Please check your extension preferences.",
        );
      };

      const document = await workflowy.getDocument();

      const targetListPattern = new RegExp(preferences.targetList, "i");
      const targetList = document.root.findOne(targetListPattern);

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

      const item = targetList.createItem();

      // Get time in a short format like "09:41 AM"
      const timeStr = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      item.setName(`**${timeStr}** ${values.text}`);

      if (document.isDirty()) {
        await document.save();
      }

      toast.style = Toast.Style.Success;
      toast.title = "Logged successfully";

      // Clear the form after success
      setText("");
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

import {
  Form,
  ActionPanel,
  Action,
  showToast,
  Toast,
  getPreferenceValues,
} from "@raycast/api";
import { WorkFlowy } from "workflowy";
import { useState } from "react";

interface Preferences {
  workflowyEmail?: string;
  workflowyPassword?: string;
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

    if (
      !preferences.workflowyEmail ||
      !preferences.workflowyPassword ||
      !preferences.targetList
    ) {
      showToast({
        title: "Missing preferences",
        message:
          "Please configure your Workflowy credentials in extension preferences.",
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
      const workflowy = new WorkFlowy(
        preferences.workflowyEmail,
        preferences.workflowyPassword,
      );
      const document = await workflowy.getDocument();

      const targetListPattern = new RegExp(preferences.targetList, "i");
      const targetList = document.root.findOne(targetListPattern);

      if (!targetList) {
        toast.style = Toast.Style.Failure;
        toast.title = "Target list not found";
        toast.message = `Could not find a list matching "${preferences.targetList}"`;
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

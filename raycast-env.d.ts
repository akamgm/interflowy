/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Workflowy API Key - Your Workflowy API key */
  workflowyApiKey: string;
  /** Target List Name - The exact name or pattern of the list to append entries to (e.g., 'Journal') */
  targetList: string;
};

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences;

declare namespace Preferences {
  /** Preferences accessible in the `log-entry` command */
  export type LogEntry = ExtensionPreferences & {};
}

declare namespace Arguments {
  /** Arguments passed to the `log-entry` command */
  export type LogEntry = {};
}

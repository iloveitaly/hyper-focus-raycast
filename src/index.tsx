import fetch from "node-fetch";
import { homedir } from "os";
import { join } from "path";

import { ActionPanel, List, Action, popToRoot, showHUD, Icon } from "@raycast/api";
import { useFetch } from "@raycast/utils";

export interface FocusStatus {
  pause: FocusSchedule;
  override: FocusSchedule;
  schedule: FocusSchedule;
}

export interface FocusSchedule {
  name?: string;
  until?: number;
}

const SERVER_PORT = 9029;

function baseURL() {
  return `http://localhost:${SERVER_PORT}`;
}

function configPath() {
  return join(homedir(), ".config/focus/");
}

function minutesFromNowToTimestamp(minutes: number): number {
  return Math.round(new Date().getTime() / 1000) + minutes * 60;
}

function SetOverride(props: { [name: string]: string }) {
  async function submitOverride(overrideName: string, minutes: number) {
    const result = await fetch(`${baseURL()}/override`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: overrideName,
        until: minutesFromNowToTimestamp(minutes),
      }),
    });

    const jsonResult = await result.json();

    showHUD(`Using schedule '${overrideName}' for ${minutes} minutes`);
    popToRoot({ clearSearchBar: true });
  }

  const overrideOptions = [15, 30, 45, 60].map((minutes) => {
    return (
      <List.Item
        key={minutes}
        title={`${minutes} minutes`}
        actions={
          <ActionPanel>
            <Action onAction={() => submitOverride(props.name, minutes)} title="Pause" />
          </ActionPanel>
        }
      />
    );
  });

  return <List>{overrideOptions}</List>;
}

function ChooseOverride() {
  const { data, isLoading } = useFetch(`${baseURL()}/configurations`);

  const configurationItems = (configurationNames: string[]) =>
    configurationNames.map((name) => {
      return (
        <List.Item
          key={name}
          title={name}
          actions={
            <ActionPanel>
              <Action.Push title="Set Override" target={<SetOverride name={name} />} />
            </ActionPanel>
          }
        />
      );
    });

  return <List isLoading={isLoading}>{!isLoading && configurationItems(data as string[])}</List>;
}

function Pause() {
  async function submitPause(minutes: number) {
    const result = await fetch(`${baseURL()}/pause`, {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        until: minutesFromNowToTimestamp(minutes),
      }),
      method: "POST",
    });

    const parsedJson = await result.json();

    if (parsedJson.status == "error") {
      console.error("Error pausing Focus: ", parsedJson.message);
    }

    showHUD("Focus schedule paused for " + minutes + " minutes");
    popToRoot({ clearSearchBar: true });
  }

  const pauseOptions = [1, 5, 10, 15, 30].map((minutes) => {
    return (
      <List.Item
        key={minutes}
        title={`${minutes} minutes`}
        actions={
          <ActionPanel>
            <Action onAction={() => submitPause(minutes)} title="Pause" />
          </ActionPanel>
        }
      />
    );
  });

  return <List>{pauseOptions}</List>;
}

function timestampToHoursMinutes(timestamp: number): string {
  const until = new Date(timestamp * 1000);
  return until.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export default function Command() {
  const { data, isLoading } = useFetch<FocusStatus>(baseURL() + "/status");

  const renderActions = () => {
    const hasScheduledFocus = data?.schedule?.until !== null;
    const hasOverrideEnabled = data?.override?.until !== null;
    const isPaused = data?.pause?.until !== null;

    let summaryItem: React.ReactNode;

    // TODO unclear to me if List.Item is the best way to display general application status. Would be nice if there was
    //      a specific UI component for this. It makes the UX a bit strange.
    if (isPaused) {
      summaryItem = (
        <List.Item
          icon={Icon.PauseFilled}
          title="Focus is paused"
          subtitle={`paused until ${timestampToHoursMinutes(data.pause.until)}`}
        />
      );
    } else if (hasOverrideEnabled) {
      summaryItem = (
        <List.Item
          icon={Icon.Wand}
          title={`Focusing using '${data?.override?.name}'`}
          subtitle={`overriding until ${timestampToHoursMinutes(data.override.until)}`}
        />
      );
    } else if (hasScheduledFocus) {
      summaryItem = (
        <List.Item
          icon={Icon.Calendar}
          title={`Planned focus using '${data?.schedule?.name}'`}
          subtitle={`scheduled until ${timestampToHoursMinutes(data.schedule.until)}`}
        />
      );
    } else {
      summaryItem = <List.Item icon={Icon.Info} title="No focus schedule is active" />;
    }

    const isAbleToPause = hasScheduledFocus || hasOverrideEnabled;

    return (
      <>
        {summaryItem}
        {isAbleToPause && (
          <List.Item
            icon={Icon.Pause}
            title="Pause"
            subtitle="pause focus session"
            actions={
              <ActionPanel>
                <Action.Push title="Show Options" target={<Pause />} />
              </ActionPanel>
            }
          />
        )}
        <List.Item
          icon={Icon.Pencil}
          title="Override"
          subtitle="schedule a temporary override"
          actions={
            <ActionPanel>
              <Action.Push title="Schedule Override" target={<ChooseOverride />} />
            </ActionPanel>
          }
        />
        <List.Item
          icon={Icon.SaveDocument}
          title="Configure"
          subtitle="configure focus schedules"
          actions={
            <ActionPanel>
              <Action.ShowInFinder title="Open Configuration" path={configPath()} />
              <Action.Push title="Schedule Override" target={<ChooseOverride />} />
            </ActionPanel>
          }
        />
      </>
    );
  };

  return <List isLoading={isLoading}>{!isLoading ? renderActions() : null}</List>;
}

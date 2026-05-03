let lastStartInHandle: any | undefined;
let lastYamlFileHandle: any | undefined;
let lastYamlFileSourceLabel: string | undefined;

export function getYamlPickerStartIn(): any | undefined {
  return lastStartInHandle;
}

export function setYamlPickerStartIn(handle: any | undefined): void {
  lastStartInHandle = handle;
}

export function getYamlFileHandle(): any | undefined {
  return lastYamlFileHandle;
}

export function setYamlFileHandle(handle: any | undefined): void {
  lastYamlFileHandle = handle;
}

export function getYamlFileSourceLabel(): string | undefined {
  return lastYamlFileSourceLabel;
}

export function setYamlFileSourceLabel(label: string | undefined): void {
  lastYamlFileSourceLabel = label;
}

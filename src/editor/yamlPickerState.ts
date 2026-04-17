let lastStartInHandle: any | undefined;

export function getYamlPickerStartIn(): any | undefined {
  return lastStartInHandle;
}

export function setYamlPickerStartIn(handle: any | undefined): void {
  lastStartInHandle = handle;
}


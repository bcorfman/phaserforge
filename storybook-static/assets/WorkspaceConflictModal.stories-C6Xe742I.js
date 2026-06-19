import{i as e}from"./preload-helper-xPQekRTU.js";import{n as t,t as n}from"./WorkspaceConflictModal-CUjQoKe6.js";function r(e,t,n){return{kind:e,label:t,lastSavedLabel:`May 28, 2026, 10:14 AM`,yamlText:n,parsed:{ok:!0,summary:{scenes:1,entities:2,groups:1,assets:1},canonicalYaml:n}}}var i,a,o,s,c,l,u,d;e((()=>{t(),{expect:i,fn:a,userEvent:o,within:s}=__STORYBOOK_MODULE_TEST__,c={title:`Editor/WorkspaceConflictModal`,component:n,args:{cloud:r(`cloud`,`Cloud`,`id: cloud
scenes:
  scene-1: {}`),device:r(`device`,`This device`,`id: device
scenes:
  scene-1: {}`),onExportBoth:a(),onChooseCloud:a(),onChooseDevice:a(),onClose:a()}},l={play:async({canvasElement:e,args:t})=>{let n=s(e);await o.click(n.getAllByRole(`button`,{name:`Preview`})[0]),i(n.getByTestId(`workspace-conflict-preview`).textContent).toContain(`Scenes: 1`),i(n.getByTestId(`workspace-conflict-preview`).textContent).toContain(`id: cloud`),await o.click(n.getByTestId(`workspace-conflict-use-cloud`)),i(t.onChooseCloud).toHaveBeenCalled()}},u={play:async({canvasElement:e,args:t})=>{let n=s(e);await o.click(n.getByTestId(`workspace-conflict-export-both`)),await o.click(n.getByTestId(`workspace-conflict-use-device`)),i(t.onExportBoth).toHaveBeenCalled(),i(t.onChooseDevice).toHaveBeenCalled()}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getAllByRole('button', {
      name: 'Preview'
    })[0]);
    expect(canvas.getByTestId('workspace-conflict-preview').textContent).toContain('Scenes: 1');
    expect(canvas.getByTestId('workspace-conflict-preview').textContent).toContain('id: cloud');
    await userEvent.click(canvas.getByTestId('workspace-conflict-use-cloud'));
    expect(args.onChooseCloud).toHaveBeenCalled();
  }
}`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId('workspace-conflict-export-both'));
    await userEvent.click(canvas.getByTestId('workspace-conflict-use-device'));
    expect(args.onExportBoth).toHaveBeenCalled();
    expect(args.onChooseDevice).toHaveBeenCalled();
  }
}`,...u.parameters?.docs?.source}}},d=[`PreviewAndChooseCloud`,`ExportBothAndChooseDevice`]}))();export{u as ExportBothAndChooseDevice,l as PreviewAndChooseCloud,d as __namedExportsOrder,c as default};
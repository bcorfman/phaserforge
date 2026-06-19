import{i as e,s as t}from"./preload-helper-xPQekRTU.js";import{r as n}from"./iframe-xErkq7Pp.js";import{A as r,M as i,a,i as o}from"./EditorStore-CixphuFq.js";import{t as s}from"./jsx-runtime-CaZkqeYb.js";import{a as c,c as l,i as u,n as d,o as f,r as p,s as m,t as h}from"./yamlFileHandles-CeumBFj3.js";function g(){return S}function _(e){S=e}function v(){return C}function y(e){C=e}function b(){return w}function x(e){w=e}var S,C,w,T=e((()=>{}));function E({project:e,dispatch:t}){let n=(0,O.useRef)(null),r=async()=>{t({type:`set-error`,error:void 0});let e=h();if(e)try{let n=(await e({multiple:!1,types:[{description:`YAML`,accept:{"application/x-yaml":[`.yaml`,`.yml`],"text/yaml":[`.yaml`,`.yml`],"text/plain":[`.yaml`,`.yml`]}}],...g()?{startIn:g()}:{}}))?.[0];if(n){_(n),y(n);let{text:e,label:r}=await p(n);x(r),t({type:`load-yaml-text`,text:e,sourceLabel:r});return}}catch(e){if(e instanceof DOMException&&e.name===`AbortError`)return}let r=n.current;if(!r){t({type:`set-error`,error:`File picker unavailable`});return}r.value=``,!window.__PHASER_FORGE_TEST__?.isEnabled&&r.click()},a=async e=>{if(t({type:`set-error`,error:void 0}),e)try{let n=await e.text();y(void 0),x(e.name??`picked file`),t({type:`load-yaml-text`,text:n,sourceLabel:e.name??`picked file`})}catch(e){t({type:`set-error`,error:e instanceof Error?e.message:`Failed to open YAML`})}},o=async()=>{t({type:`set-error`,error:void 0});let n=v();if(!n){await s();return}try{await u(n,i(e)),t({type:`mark-saved`}),t({type:`set-status`,message:`Saved YAML: ${b()??`file`}`,expiresAt:Date.now()+4e3})}catch(e){t({type:`set-error`,error:e instanceof Error?e.message:`Failed to save YAML`})}},s=async()=>{t({type:`set-error`,error:void 0});try{let n=await c(i(e),{startIn:g()});n.kind===`saved`?(_(n.handle),y(n.handle),x(b()??`scene.yaml`),t({type:`mark-saved`}),t({type:`set-status`,message:`Saved YAML`,expiresAt:Date.now()+4e3})):(y(void 0),t({type:`mark-saved`}),t({type:`set-status`,message:`Downloaded YAML`,expiresAt:Date.now()+4e3}))}catch(e){if(e instanceof DOMException&&e.name===`AbortError`)return;t({type:`set-error`,error:e instanceof Error?e.message:`Failed to save YAML`})}};return(0,k.jsxs)(`div`,{className:`viewbar-yaml`,role:`toolbar`,"aria-label":`YAML file actions`,children:[(0,k.jsxs)(`div`,{className:`viewbar-group`,children:[(0,k.jsx)(`button`,{className:`button`,type:`button`,"data-testid":`yaml-open-button`,onClick:()=>void r(),children:`Open YAML…`}),(0,k.jsx)(`button`,{className:`button`,type:`button`,"data-testid":`yaml-save-button`,onClick:()=>void o(),children:`Save YAML`}),(0,k.jsx)(`button`,{className:`button`,type:`button`,"data-testid":`yaml-save-as-button`,onClick:()=>void s(),children:`Save YAML As…`})]}),(0,k.jsx)(`input`,{"aria-hidden":`true`,"data-testid":`yaml-open-file-input`,ref:n,type:`file`,accept:`.yaml,.yml,application/x-yaml,text/yaml,text/plain`,style:{display:`none`},onChange:async e=>{let t=e.currentTarget.files?.[0]??null;e.currentTarget.value=``,await a(t)}})]})}function D(){let{state:e,dispatch:t}=a();return(0,k.jsx)(E,{project:e.project,dispatch:t})}var O,k,A=e((()=>{O=t(n()),r(),o(),f(),T(),d(),k=s(),E.__docgenInfo={description:``,methods:[],displayName:`ViewbarYamlControlsView`,props:{project:{required:!0,tsType:{name:`ReturnType['state']['project']`,raw:`ReturnType<typeof useEditorStore>['state']['project']`},description:``},dispatch:{required:!0,tsType:{name:`ReturnType['dispatch']`,raw:`ReturnType<typeof useEditorStore>['dispatch']`},description:``}}},D.__docgenInfo={description:``,methods:[],displayName:`ViewbarYamlControls`}}));function j(){let[e,t]=(0,M.useState)(l);return(0,N.jsx)(E,{project:e,dispatch:F(e=>{let n=window.__YAML_STORY_STATE__;n&&n.dispatchCalls.push(e),e.type===`load-yaml-text`&&t(t=>({...t,id:e.sourceLabel.replace(/\.ya?ml$/i,``)||t.id}))})})}var M,N,P,F,I,L,R,z,B,V,H;e((()=>{M=t(n()),m(),A(),T(),N=s(),{expect:P,fn:F,userEvent:I,waitFor:L,within:R}=__STORYBOOK_MODULE_TEST__,z={title:`Editor/ViewbarYamlControls`,component:j},B={play:async({canvasElement:e})=>{_(void 0),y(void 0),x(void 0);let t={getFile:async()=>new File([`id: picked`],`picked.yaml`,{type:`application/x-yaml`})},n={createWritable:async()=>({write:async()=>{},close:async()=>{}})};window.__YAML_STORY_STATE__={dispatchCalls:[]},window.__YAML_PICKER_STORY__={openCalls:[],saveCalls:[],openHandle:t,saveHandle:n},window.showOpenFilePicker=async e=>(window.__YAML_PICKER_STORY__.openCalls.push(e),[t]),window.showSaveFilePicker=async e=>(window.__YAML_PICKER_STORY__.saveCalls.push(e),n);let r=R(e);await I.click(r.getByTestId(`yaml-open-button`)),await I.click(r.getByTestId(`yaml-save-as-button`)),await I.click(r.getByTestId(`yaml-open-button`)),await L(()=>{let e=window.__YAML_PICKER_STORY__;P(e.saveCalls).toHaveLength(1),P(e.openCalls).toHaveLength(2),P(e.saveCalls[0]?.startIn).toBe(e.openHandle),P(e.openCalls[1]?.startIn).toBe(e.saveHandle)})}},V={play:async({canvasElement:e})=>{let t=[],n={createWritable:async()=>({write:async e=>t.push(e),close:async()=>{}})};_(void 0),y(n),x(`scene.yaml`),window.__YAML_STORY_STATE__={dispatchCalls:[]},window.__YAML_SAVE_STORY__={writes:t,saveHandle:n},window.showSaveFilePicker=async()=>n,window.showOpenFilePicker=void 0;let r=R(e);await I.click(r.getByTestId(`yaml-save-button`)),await L(()=>{P(window.__YAML_SAVE_STORY__.writes.length).toBe(1)}),P(window.__YAML_STORY_STATE__.dispatchCalls).toEqual(P.arrayContaining([{type:`set-error`,error:void 0},{type:`mark-saved`},P.objectContaining({type:`set-status`,message:`Saved YAML: scene.yaml`})]))}},B.parameters={...B.parameters,docs:{...B.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    setYamlPickerStartIn(undefined);
    setYamlFileHandle(undefined);
    setYamlFileSourceLabel(undefined);
    const openHandle: any = {
      getFile: async () => new File(['id: picked'], 'picked.yaml', {
        type: 'application/x-yaml'
      })
    };
    const saveHandle: any = {
      createWritable: async () => ({
        write: async () => {},
        close: async () => {}
      })
    };
    (window as any).__YAML_STORY_STATE__ = {
      dispatchCalls: []
    };
    (window as any).__YAML_PICKER_STORY__ = {
      openCalls: [],
      saveCalls: [],
      openHandle,
      saveHandle
    };
    (window as any).showOpenFilePicker = async (options: any) => {
      (window as any).__YAML_PICKER_STORY__.openCalls.push(options);
      return [openHandle];
    };
    (window as any).showSaveFilePicker = async (options: any) => {
      (window as any).__YAML_PICKER_STORY__.saveCalls.push(options);
      return saveHandle;
    };
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId('yaml-open-button'));
    await userEvent.click(canvas.getByTestId('yaml-save-as-button'));
    await userEvent.click(canvas.getByTestId('yaml-open-button'));
    await waitFor(() => {
      const testState = (window as any).__YAML_PICKER_STORY__;
      expect(testState.saveCalls).toHaveLength(1);
      expect(testState.openCalls).toHaveLength(2);
      expect(testState.saveCalls[0]?.startIn).toBe(testState.openHandle);
      expect(testState.openCalls[1]?.startIn).toBe(testState.saveHandle);
    });
  }
}`,...B.parameters?.docs?.source}}},V.parameters={...V.parameters,docs:{...V.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const writes: string[] = [];
    const saveHandle: any = {
      createWritable: async () => ({
        write: async (text: string) => writes.push(text),
        close: async () => {}
      })
    };
    setYamlPickerStartIn(undefined);
    setYamlFileHandle(saveHandle);
    setYamlFileSourceLabel('scene.yaml');
    (window as any).__YAML_STORY_STATE__ = {
      dispatchCalls: []
    };
    (window as any).__YAML_SAVE_STORY__ = {
      writes,
      saveHandle
    };
    (window as any).showSaveFilePicker = async () => saveHandle;
    (window as any).showOpenFilePicker = undefined;
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId('yaml-save-button'));
    await waitFor(() => {
      expect((window as any).__YAML_SAVE_STORY__.writes.length).toBe(1);
    });
    expect((window as any).__YAML_STORY_STATE__.dispatchCalls).toEqual(expect.arrayContaining([{
      type: 'set-error',
      error: undefined
    }, {
      type: 'mark-saved'
    }, expect.objectContaining({
      type: 'set-status',
      message: 'Saved YAML: scene.yaml'
    })]));
  }
}`,...V.parameters?.docs?.source}}},H=[`OpenAndSaveSharePickerHandle`,`SaveExistingHandle`]}))();export{B as OpenAndSaveSharePickerHandle,V as SaveExistingHandle,H as __namedExportsOrder,z as default};
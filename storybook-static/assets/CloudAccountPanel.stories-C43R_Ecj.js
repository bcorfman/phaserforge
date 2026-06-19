import{i as e,s as t}from"./preload-helper-xPQekRTU.js";import{n,r,t as i}from"./iframe-xErkq7Pp.js";import{t as a}from"./jsx-runtime-CaZkqeYb.js";import{i as o,n as s}from"./CloudAccountPanel-mZNUFeIr.js";function c({initialProject:e}){let[t,n]=(0,l.useState)(e??{id:`project-1`,assets:{images:{},spriteSheets:{},fonts:{}},audio:{sounds:{}}});return(0,u.jsx)(s,{state:{project:t},dispatch:e=>{e.type===`set-project-metadata`&&n(t=>({...t,...typeof e.title==`string`?{title:e.title}:{},...typeof e.publishGithubPagesRepo==`string`?{publishGithubPagesRepo:e.publishGithubPagesRepo}:{}}))},onLoadYaml:()=>{},onStatus:()=>{},onError:()=>{}})}var l,u,d,f,p,m,h,g,_,v,y,b,x,S,C;e((()=>{l=t(r()),o(),n(),u=a(),{expect:d,userEvent:f,waitFor:p,within:m}=__STORYBOOK_MODULE_TEST__,h={title:`Editor/CloudAccountPanel`,component:c,args:{initialProject:void 0}},g={play:async({canvasElement:e})=>{let t=m(e);await p(()=>d(t.getByLabelText(`Email`)).toBeTruthy());let n=t.getByRole(`tab`,{name:`Log in`}),r=t.getByRole(`tab`,{name:`Create`});d(r.className).toContain(`active`),d(n.className).not.toContain(`active`),await f.click(n),d(n.className).toContain(`active`),d(r.className).not.toContain(`active`)}},_={parameters:{msw:{handlers:i({user:null,loginUser:{id:`u1`,email:`a@b.c`},publishInfo:{ok:!1,error:`github_not_linked`}})}},play:async({canvasElement:e})=>{let t=m(e);await p(()=>d(t.getByLabelText(`Email`)).toBeTruthy()),await f.click(t.getByRole(`tab`,{name:`Log in`})),await f.type(t.getByLabelText(`Email`),`a@b.c`),await f.type(t.getByLabelText(`Password`),`pw`),await f.click(t.getByTestId(`cloud-account-submit`)),await p(()=>d(t.getByTestId(`cloud-account-section`).textContent).toContain(`Signed in`)),d(t.getByRole(`button`,{name:`Connect GitHub`})).toBeTruthy()}},v={parameters:{msw:{handlers:i({user:{id:`u1`,email:`alice@example.com`},publishInfo:{ok:!1,error:`github_not_linked`}})}},play:async({canvasElement:e})=>{let t=m(e);await p(()=>d(t.getByTestId(`cloud-publish-connect-github-cta`)).toBeTruthy()),await f.click(t.getByTestId(`cloud-publish-connect-github-cta`)),await p(()=>d(t.getByTestId(`github-connect-modal`)).toBeTruthy())}},y={args:{initialProject:{id:`project-1`,title:`My Game`,assets:{images:{i1:{id:`i1`,source:{kind:`embedded`,dataUrl:`data:image/png;base64,AAAA`,originalName:`img.png`,mimeType:`image/png`}}},spriteSheets:{},fonts:{}},audio:{sounds:{}}}},parameters:{msw:{handlers:i({user:{id:`u1`,email:`a@b.c`},publishInfo:{ok:!0,login:`alice`,pagesBaseUrl:`https://alice.github.io/`}})}},play:async({canvasElement:e})=>{let t=m(e);await p(()=>d(t.getByLabelText(`Publish repository`)).toBeTruthy()),await f.clear(t.getByLabelText(`Publish repository`)),await f.type(t.getByLabelText(`Publish repository`),`mygame`),await p(()=>{d(t.getByTestId(`cloud-publish-pages-target`).textContent).toContain(`https://alice.github.io/mygame/`),d(t.getByTestId(`cloud-publish-pages-button`).disabled).toBe(!1),d(t.getByTestId(`cloud-publish-pages-help`).textContent??``).toBe(``)})}},b={args:{initialProject:{id:`project-1`,title:`Zoof`,publishGithubPagesRepo:`zoof`,assets:{images:{},spriteSheets:{},fonts:{}},audio:{sounds:{}}}},parameters:{msw:{handlers:i({user:{id:`u1`,email:`a@b.c`},publishInfo:{ok:!0,login:`alice`,pagesBaseUrl:`https://alice.github.io/`}})}},play:async({canvasElement:e})=>{let t=m(e);await p(()=>d(t.getByLabelText(`Publish repository`)).toBeTruthy()),d(t.getByTestId(`cloud-publish-prereq`).textContent).toContain(`Before first publish`),d(t.getByTestId(`cloud-publish-pages-target`).textContent).toContain(`https://alice.github.io/zoof/`)}},x={args:{initialProject:{id:`project-1`,title:`Zoof`,publishGithubPagesRepo:`zoof`,assets:{images:{},spriteSheets:{},fonts:{}},audio:{sounds:{}}}},parameters:{msw:{handlers:i({user:{id:`u1`,email:`a@b.c`},publishInfo:{ok:!0,login:`alice`,pagesBaseUrl:`https://alice.github.io/`},publishCheck:{ok:!0,url:`https://alice.github.io/zoof/`,exists:!1,routeExists:!1,pagesConfigured:!1,deploymentStatus:null},publishResult:{ok:!0,url:`https://alice.github.io/zoof/`,repo:`zoof`,repoCreated:!0,deploymentStatus:`queued`}})}},play:async({canvasElement:e})=>{let t=m(e);await p(()=>d(t.getByTestId(`cloud-publish-pages-button`)).toBeTruthy()),await f.click(t.getByTestId(`cloud-publish-pages-button`)),await p(()=>d(t.getByTestId(`publish-confirm-modal`).textContent).toContain(`A new repository will be created`)),await f.click(t.getByTestId(`publish-confirm-submit`)),await p(()=>d(t.getByTestId(`cloud-publish-pages-help`).textContent).toContain(`GitHub Pages accepted the deployment for zoof`))}},S={args:{initialProject:{id:`project-1`,title:`Zoof`,publishGithubPagesRepo:`zoof`,assets:{images:{},spriteSheets:{},fonts:{}},audio:{sounds:{}}}},parameters:{msw:{handlers:i({user:{id:`u1`,email:`a@b.c`},publishInfo:{ok:!0,login:`alice`,pagesBaseUrl:`https://alice.github.io/`},publishCheck:{ok:!0,url:`https://alice.github.io/zoof/`,exists:!0,routeExists:!0,pagesConfigured:!0,deploymentStatus:`built`},publishResult:{ok:!1,error:`github_pages_permission_required`}})}},play:async({canvasElement:e})=>{let t=m(e);await p(()=>d(t.getByTestId(`cloud-publish-pages-button`)).toBeTruthy()),await f.click(t.getByTestId(`cloud-publish-pages-button`)),await p(()=>d(t.getByTestId(`publish-confirm-modal`)).toBeTruthy()),await f.click(t.getByTestId(`publish-confirm-submit`)),await p(()=>d(t.getByTestId(`cloud-publish-pages-help`).textContent).toContain(`GitHub denied GitHub Pages management access`))}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByLabelText('Email')).toBeTruthy());
    const loginTab = canvas.getByRole('tab', {
      name: 'Log in'
    });
    const createTab = canvas.getByRole('tab', {
      name: 'Create'
    });
    expect(createTab.className).toContain('active');
    expect(loginTab.className).not.toContain('active');
    await userEvent.click(loginTab);
    expect(loginTab.className).toContain('active');
    expect(createTab.className).not.toContain('active');
  }
}`,...g.parameters?.docs?.source}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{
  parameters: {
    msw: {
      handlers: createCloudAuthHandlers({
        user: null,
        loginUser: {
          id: 'u1',
          email: 'a@b.c'
        },
        publishInfo: {
          ok: false,
          error: 'github_not_linked'
        }
      })
    }
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByLabelText('Email')).toBeTruthy());
    await userEvent.click(canvas.getByRole('tab', {
      name: 'Log in'
    }));
    await userEvent.type(canvas.getByLabelText('Email'), 'a@b.c');
    await userEvent.type(canvas.getByLabelText('Password'), 'pw');
    await userEvent.click(canvas.getByTestId('cloud-account-submit'));
    await waitFor(() => expect(canvas.getByTestId('cloud-account-section').textContent).toContain('Signed in'));
    expect(canvas.getByRole('button', {
      name: 'Connect GitHub'
    })).toBeTruthy();
  }
}`,..._.parameters?.docs?.source}}},v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  parameters: {
    msw: {
      handlers: createCloudAuthHandlers({
        user: {
          id: 'u1',
          email: 'alice@example.com'
        },
        publishInfo: {
          ok: false,
          error: 'github_not_linked'
        }
      })
    }
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByTestId('cloud-publish-connect-github-cta')).toBeTruthy());
    await userEvent.click(canvas.getByTestId('cloud-publish-connect-github-cta'));
    await waitFor(() => expect(canvas.getByTestId('github-connect-modal')).toBeTruthy());
  }
}`,...v.parameters?.docs?.source}}},y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    initialProject: {
      id: 'project-1',
      title: 'My Game',
      assets: {
        images: {
          i1: {
            id: 'i1',
            source: {
              kind: 'embedded',
              dataUrl: 'data:image/png;base64,AAAA',
              originalName: 'img.png',
              mimeType: 'image/png'
            }
          }
        },
        spriteSheets: {},
        fonts: {}
      },
      audio: {
        sounds: {}
      }
    }
  },
  parameters: {
    msw: {
      handlers: createCloudAuthHandlers({
        user: {
          id: 'u1',
          email: 'a@b.c'
        },
        publishInfo: {
          ok: true,
          login: 'alice',
          pagesBaseUrl: 'https://alice.github.io/'
        }
      })
    }
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByLabelText('Publish repository')).toBeTruthy());
    await userEvent.clear(canvas.getByLabelText('Publish repository'));
    await userEvent.type(canvas.getByLabelText('Publish repository'), 'mygame');
    await waitFor(() => {
      expect(canvas.getByTestId('cloud-publish-pages-target').textContent).toContain('https://alice.github.io/mygame/');
      expect((canvas.getByTestId('cloud-publish-pages-button') as HTMLButtonElement).disabled).toBe(false);
      expect(canvas.getByTestId('cloud-publish-pages-help').textContent ?? '').toBe('');
    });
  }
}`,...y.parameters?.docs?.source}}},b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    initialProject: {
      id: 'project-1',
      title: 'Zoof',
      publishGithubPagesRepo: 'zoof',
      assets: {
        images: {},
        spriteSheets: {},
        fonts: {}
      },
      audio: {
        sounds: {}
      }
    }
  },
  parameters: {
    msw: {
      handlers: createCloudAuthHandlers({
        user: {
          id: 'u1',
          email: 'a@b.c'
        },
        publishInfo: {
          ok: true,
          login: 'alice',
          pagesBaseUrl: 'https://alice.github.io/'
        }
      })
    }
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByLabelText('Publish repository')).toBeTruthy());
    expect(canvas.getByTestId('cloud-publish-prereq').textContent).toContain('Before first publish');
    expect(canvas.getByTestId('cloud-publish-pages-target').textContent).toContain('https://alice.github.io/zoof/');
  }
}`,...b.parameters?.docs?.source}}},x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  args: {
    initialProject: {
      id: 'project-1',
      title: 'Zoof',
      publishGithubPagesRepo: 'zoof',
      assets: {
        images: {},
        spriteSheets: {},
        fonts: {}
      },
      audio: {
        sounds: {}
      }
    }
  },
  parameters: {
    msw: {
      handlers: createCloudAuthHandlers({
        user: {
          id: 'u1',
          email: 'a@b.c'
        },
        publishInfo: {
          ok: true,
          login: 'alice',
          pagesBaseUrl: 'https://alice.github.io/'
        },
        publishCheck: {
          ok: true,
          url: 'https://alice.github.io/zoof/',
          exists: false,
          routeExists: false,
          pagesConfigured: false,
          deploymentStatus: null
        },
        publishResult: {
          ok: true,
          url: 'https://alice.github.io/zoof/',
          repo: 'zoof',
          repoCreated: true,
          deploymentStatus: 'queued'
        }
      })
    }
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByTestId('cloud-publish-pages-button')).toBeTruthy());
    await userEvent.click(canvas.getByTestId('cloud-publish-pages-button'));
    await waitFor(() => expect(canvas.getByTestId('publish-confirm-modal').textContent).toContain('A new repository will be created'));
    await userEvent.click(canvas.getByTestId('publish-confirm-submit'));
    await waitFor(() => expect(canvas.getByTestId('cloud-publish-pages-help').textContent).toContain('GitHub Pages accepted the deployment for zoof'));
  }
}`,...x.parameters?.docs?.source}}},S.parameters={...S.parameters,docs:{...S.parameters?.docs,source:{originalSource:`{
  args: {
    initialProject: {
      id: 'project-1',
      title: 'Zoof',
      publishGithubPagesRepo: 'zoof',
      assets: {
        images: {},
        spriteSheets: {},
        fonts: {}
      },
      audio: {
        sounds: {}
      }
    }
  },
  parameters: {
    msw: {
      handlers: createCloudAuthHandlers({
        user: {
          id: 'u1',
          email: 'a@b.c'
        },
        publishInfo: {
          ok: true,
          login: 'alice',
          pagesBaseUrl: 'https://alice.github.io/'
        },
        publishCheck: {
          ok: true,
          url: 'https://alice.github.io/zoof/',
          exists: true,
          routeExists: true,
          pagesConfigured: true,
          deploymentStatus: 'built'
        },
        publishResult: {
          ok: false,
          error: 'github_pages_permission_required'
        }
      })
    }
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByTestId('cloud-publish-pages-button')).toBeTruthy());
    await userEvent.click(canvas.getByTestId('cloud-publish-pages-button'));
    await waitFor(() => expect(canvas.getByTestId('publish-confirm-modal')).toBeTruthy());
    await userEvent.click(canvas.getByTestId('publish-confirm-submit'));
    await waitFor(() => expect(canvas.getByTestId('cloud-publish-pages-help').textContent).toContain('GitHub denied GitHub Pages management access'));
  }
}`,...S.parameters?.docs?.source}}},C=[`SignedOut`,`EmailLogin`,`SignedInGithubUnlinked`,`PublishRepoEntryReady`,`PublishReady`,`PublishFirstTimeSuccess`,`PublishFailure`]}))();export{_ as EmailLogin,S as PublishFailure,x as PublishFirstTimeSuccess,b as PublishReady,y as PublishRepoEntryReady,v as SignedInGithubUnlinked,g as SignedOut,C as __namedExportsOrder,h as default};
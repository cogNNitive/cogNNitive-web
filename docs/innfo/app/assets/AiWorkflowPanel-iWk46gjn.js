import{aD as j,aG as i,aH as l,aP as e,aR as f,aS as r,aQ as y,aI as N,aK as I,aL as D,bc as V,aJ as T,bN as F,aZ as R,bO as B,aM as U,bP as G,bQ as Y,bR as z,aE as S,b2 as Q,bS as Z,bT as q}from"./index-BIbQQDN3.js";import{i as $,D as J}from"./prompt-C2ZQGS6v.js";const K=`---
spec_version: "V_0-2-1"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
level: 3
parent_spec:
  name: "procedures"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
blueprint_version: "V_0-2-1"
knowledge_version: "V_0-1-0"
title: "Use iNNfo with AI"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[Work]]
* [[Tools]]
* [[Roles]]
* [[Artifact]]

# NN Work

## NN Work: Use iNNfo with AI
iNNfo lets you edit and view iNNfo models both from its graphical interface and through AI agents. This procedure describes how to work with your models via natural language conversation across modern AI coding agents (OpenCode Desktop, Google Antigravity, Claude Code, Codex / OpenAI, Cursor), leveraging the contextual prompts the application provides.

## NN Work: Download and install OpenCode Desktop
step_type:: task
tool:: [[OpenCode Desktop]]
Download OpenCode Desktop from https://opencode.ai/download and install it. OpenCode Desktop is the recommended reference desktop client for iNNfo — it reads project skills natively and discovers them automatically. You can also use other AI coding environments such as Google Antigravity, Claude Code, Cursor, or Codex.

## NN Work: Open the workspace folder in your AI agent
parent:: [[Use iNNfo with AI]]
step_type:: task
input:: [[Workspace Folder]]
tool:: [[OpenCode Desktop]]
Open the same workspace folder you use in iNNfo inside OpenCode Desktop or your chosen AI coding agent. You can find the exact path at the top of the header by clicking the info icon. The agent works directly on the file system.

## NN Work: Configure MCP tools
parent:: [[Use iNNfo with AI]]
step_type:: task
tool:: [[OpenCode Desktop]]
The first time you work with models, tell your AI agent: *"innfo: Load the nn-innfo skill and check that innfo-mcp is configured"*. The skill detects if the MCP server is set up and guides you through any steps if needed. Reference: \`docs/mcp-setup.md\`.

## NN Work: Edit models via chat
parent:: [[Use iNNfo with AI]]
step_type:: task
input:: [[Model File]]
output:: [[Edited Model File]]
tool:: [[OpenCode Desktop]]
Tell your AI agent what you want to do including a reference to the skill you need, for example: *"innfo: Load the nn-innfo skill — I need to edit a model and add a new concept"*. The skill reference in your message helps the agent discover and activate the right skill automatically. The skill provides model validation, MCP activation, and change workflows.

## NN Work: Use the suggested prompts
parent:: [[Use iNNfo with AI]]
step_type:: task
input:: [[Suggested Prompts]]
tool:: [[OpenCode Desktop]]
When viewing a model in iNNfo, the right sidebar shows **suggested prompts** for each concept. Copy them into OpenCode Desktop or your AI agent to explore a specific concept or element in more detail.

# NN Roles

## NN Roles: User
scope:: internal
Person who directs model editing. Describes the changes they want in natural language and the agent executes them.

## NN Roles: AI Agent
scope:: external
AI agent (e.g. OpenCode Desktop, Google Antigravity, Claude Code, Cursor, Codex) that interprets user instructions and modifies model files directly on the file system.

# NN Artifact

## NN Artifact: Model File
\`_NN.md\` file containing the iNNfo model. The main artifact edited and viewed both in iNNfo and through the AI agent.

## NN Artifact: Workspace Folder
Local folder containing the model, its templates, and associated specs. The directory you share between iNNfo and your AI agent so both work on the same files.

## NN Artifact: Suggested Prompts
Text snippets that appear in the iNNfo right sidebar when you select a concept. Designed to be copied and pasted into your AI agent.

## NN Artifact: Edited Model File
Updated \`_NN.md\` model file containing valid elements, fields, and matrices conforming to its declared template.

# NN Tools

## NN Tools: OpenCode Desktop
Recommended reference desktop client for iNNfo. Reads project skills natively and discovers them automatically. Download: https://opencode.ai/download

## NN Tools: AI Coding Agents
Compatible with modern AI coding agents including Google Antigravity, Claude Code, Cursor, and Codex CLI supporting MCP and skill workflows. Download: https://cognnitive.com/use

# NN matrices: work-roles matrix

| Work \\ Roles | User | AI Agent |
| :--- | :---: | :---: |
| Download and install OpenCode Desktop | Responsible | - |
| Open the workspace folder in your AI agent | Responsible | - |
| Configure MCP tools | Responsible | Accountable |
| Edit models via chat | Responsible | Accountable |
| Use the suggested prompts | Responsible | Consulted |
`;function X(C,h,m){const d=`${C} ${h.join(" ")} ${m.join(" ")}`,g=d.toLowerCase(),p=d.match(/\*"(innfo:[^"]+)"\*/i)||d.match(/"(innfo:[^"]+)"/i);if(p){const n=p[1].trim();return n.startsWith("innfo: ")?n:$(n.replace(/^innfo:\s*/i,""))}return g.includes("edit model")||g.includes("edit models")?$("Load the nn-innfo skill — I need to edit a model"):g.includes("configure mcp")?$("Load the nn-innfo skill and check that innfo-mcp is configured"):null}function ee(C){const h=C.split(`
`),m=[],d=[];let g=[];const p=[];let n="Use iNNfo with AI",o="Edit your iNNfo models using your preferred AI coding agent",s=null,c=null,k=!1,L=[],M=[],W=[],O=!1;const v=[];function E(){if(s!=null&&s.title){const u=M.join(`
`).trim();s.descriptionHtml=u.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/\n/g,"<br>"),s.prompt=X(s.title,L,M),d.push(s)}s=null,L=[],M=[],k=!1}function H(){if(c!=null&&c.name){const u=W.join(" ").trim();let a=c.url||"",t=u;const b=u.match(/Download:\s*(\S+)/i);if(b)a=b[1].trim(),t=u.replace(/Download:\s*\S+/i,"").trim();else if(!a){const w=u.match(/https?:\/\/\S+/i);w&&(a=w[0].trim())}const _=c.name.split(/\s+/).map(w=>w[0]).join("").slice(0,2).toUpperCase();m.push({name:c.name,initials:_,description:t||c.name,url:a||"https://cognnitive.com/use"})}c=null,W=[]}function A(){E(),H()}for(const u of h){const a=u.trimEnd(),t=a.trim(),b=a.match(/^title:\s*"(.+)"$/);if(b){n=b[1];continue}const _=a.match(/^subtitle:\s*"(.+)"$/);if(_){o=_[1];continue}if(/^#*\s*_?NN\s+matrices:/i.test(a)){A(),O=!0;continue}if(O&&(a.startsWith("|")?v.push(a):t===""&&v.length>0||!a.startsWith("|")&&!a.startsWith(":---")&&v.length>0&&(O=!1),O))continue;if(/^#+\s+_?NN\s+(?:index|Concept Definition|Field Definition|Marker Definition|Matrix Definition|Procedure|Roles|Artifact)/i.test(a)){A();continue}const w=a.match(/^(?:##|\*)\s+_?NN\s+Tools:\s*(.+)$/i);if(w){A(),c={name:w[1].trim()};continue}if(c){t.startsWith("url::")?c.url=t.replace(/^url::\s*/,"").trim():t&&W.push(t);continue}const P=a.match(/^(?:##|\*)\s+_?NN\s+Work:\s*(.+)$/i);if(P){A(),s={title:P[1].trim(),descriptionHtml:"",prompt:null};continue}if(s){if(t==="```yaml"){k=!0;continue}if(k&&t==="```"){k=!1;continue}if(k){L.push(t);continue}if(/^[a-zA-Z_]+::/.test(t)){L.push(t);continue}t&&M.push(t)}}if(A(),v.length>0){const u=v.find(t=>t.startsWith("|")&&!t.includes("---")),a=v.filter(t=>t!==u&&!t.includes("---")&&t.startsWith("|"));u&&(g=u.split("|").map(t=>t.trim()).filter(Boolean));for(const t of a){const b=t.split("|").map(_=>_.trim()).filter(Boolean);b.length>0&&p.push(b)}}return{title:n,subtitle:o,tools:m,steps:d,matrixHeaders:g,matrixRows:p}}const x=ee(K),te={class:"flex-1 overflow-y-auto p-6"},oe={class:"max-w-3xl mx-auto space-y-6"},se={class:"flex items-center gap-3"},ne={class:"text-lg font-bold text-slate-900 dark:text-slate-100"},ie={class:"text-sm text-slate-500 dark:text-slate-400"},re={key:0},ae={class:"text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2"},le={class:"space-y-2"},de=["href"],ce={class:"w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shrink-0"},pe={class:"flex-1 min-w-0"},ue={class:"text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors"},he={class:"text-xs text-slate-500 dark:text-slate-400 mt-0.5"},fe={key:1},me={class:"text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2"},ge={class:"space-y-2"},xe=["onClick"],ke={class:"flex-1 min-w-0 text-sm font-semibold text-slate-800 dark:text-slate-200"},be={key:0,class:"px-4 pb-4 pl-[3.25rem]"},Ne=["innerHTML"],we={key:0,class:"mt-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"},ve={class:"p-3"},_e={class:"block text-xs text-slate-700 dark:text-slate-300 font-mono leading-relaxed whitespace-pre-wrap"},ye={class:"flex items-center justify-end px-3 py-2 border-t border-slate-200 dark:border-slate-700"},Ce=["onClick"],Ae={key:2},Ie={class:"text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2"},De={class:"bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden"},Te={class:"w-full text-xs"},Le={class:"bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-700"},Me=j({__name:"AIGuidePanel",setup(C){const h=S(0),m=S(null);function d(p){h.value=h.value===p?null:p}function g(p,n){navigator.clipboard.writeText(p).catch(()=>{const o=document.createElement("textarea");o.value=p,document.body.appendChild(o),o.select(),document.execCommand("copy"),document.body.removeChild(o)}),m.value=n,setTimeout(()=>{m.value=null},2e3)}return(p,n)=>(i(),l("div",te,[e("div",oe,[e("div",se,[n[0]||(n[0]=e("div",{class:"w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-sm"},[e("span",{class:"text-white font-bold text-sm"},"AI")],-1)),e("div",null,[e("h1",ne,f(r(x).title),1),e("p",ie,f(r(x).subtitle),1)])]),n[4]||(n[4]=e("div",{class:"bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-950/20 dark:to-violet-950/20 border border-purple-200/60 dark:border-purple-800/30 rounded-xl p-5"},[e("p",{class:"text-sm text-slate-700 dark:text-slate-300 leading-relaxed"},[y(" This guide is generated from the procedure model at "),e("code",{class:"text-2xs bg-purple-100 dark:bg-purple-900/40 px-1.5 py-0.5 rounded font-mono"},"src/ai-guide/procedure_NN.md"),y(" — loaded at build time, no workspace required. ")])],-1)),r(x).tools.length>0?(i(),l("section",re,[e("h2",ae,[N(r(J),{class:"w-4 h-4 text-purple-500"}),n[1]||(n[1]=y(" Tools ",-1))]),e("div",le,[(i(!0),l(I,null,D(r(x).tools,o=>(i(),l("a",{key:o.name,href:o.url,target:"_blank",rel:"noopener noreferrer",class:"flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-sm transition-all group"},[e("div",ce,f(o.initials),1),e("div",pe,[e("p",ue,f(o.name),1),e("p",he,f(o.description),1)]),N(r(V),{class:"w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-purple-500 transition-colors shrink-0"})],8,de))),128))])])):T("",!0),r(x).steps.length>0?(i(),l("section",fe,[e("h2",me,[N(r(F),{class:"w-4 h-4 text-purple-500"}),n[2]||(n[2]=y(" Steps ",-1))]),e("div",ge,[(i(!0),l(I,null,D(r(x).steps,(o,s)=>(i(),l("div",{key:s,class:"bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden"},[e("div",{class:"flex items-center gap-3 p-4 cursor-pointer select-none",onClick:c=>d(s)},[e("div",{class:R(["flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0",h.value===s?"bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300":"bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"])},f(s+1),3),e("h3",ke,f(o.title),1),N(r(B),{class:R(["w-4 h-4 text-slate-400 shrink-0 transition-transform",h.value===s?"rotate-180":""])},null,8,["class"])],8,xe),h.value===s?(i(),l("div",be,[e("div",{class:"text-xs text-slate-600 dark:text-slate-400 leading-relaxed space-y-2",innerHTML:o.descriptionHtml},null,8,Ne),o.prompt?(i(),l("div",we,[e("div",ve,[e("code",_e,f(o.prompt),1)]),e("div",ye,[e("button",{onClick:c=>g(o.prompt,s),class:"inline-flex items-center gap-1.5 text-2xs font-medium px-3 py-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors cursor-pointer"},[m.value===s?(i(),U(r(G),{key:0,class:"w-3 h-3"})):(i(),U(r(Y),{key:1,class:"w-3 h-3"})),y(" "+f(m.value===s?"Copied":"Copy"),1)],8,Ce)])])):T("",!0)])):T("",!0)]))),128))])])):T("",!0),r(x).matrixHeaders.length>0?(i(),l("section",Ae,[e("h2",Ie,[N(r(z),{class:"w-4 h-4 text-purple-500"}),n[3]||(n[3]=y(" Roles ",-1))]),e("div",De,[e("table",Te,[e("thead",null,[e("tr",Le,[(i(!0),l(I,null,D(r(x).matrixHeaders,o=>(i(),l("th",{key:o,class:"text-left px-4 py-2.5 font-semibold text-slate-600 dark:text-slate-400"},f(o),1))),128))])]),e("tbody",null,[(i(!0),l(I,null,D(r(x).matrixRows,(o,s)=>(i(),l("tr",{key:s,class:"border-b border-slate-100 dark:border-slate-800 last:border-0"},[(i(!0),l(I,null,D(o,(c,k)=>(i(),l("td",{key:k,class:R(["px-4 py-2 text-slate-700 dark:text-slate-300",k===0?"font-medium":""])},f(c),3))),128))]))),128))])])])])):T("",!0)])]))}}),Oe={class:"flex flex-col h-full"},We={class:"flex items-center justify-between px-6 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0"},Re={class:"flex items-center gap-3"},$e={class:"w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-xs"},Pe={class:"flex-1 overflow-y-auto min-h-0"},je=j({__name:"AiWorkflowPanel",setup(C){const h=Q();return(m,d)=>(i(),l("div",Oe,[e("div",We,[e("div",Re,[e("div",$e,[N(r(Z),{class:"w-4 h-4 text-white"})]),d[1]||(d[1]=e("h2",{class:"text-base font-bold text-slate-900 dark:text-slate-100"},"AI Workflow",-1))]),e("button",{onClick:d[0]||(d[0]=g=>r(h).setActiveView("editor")),class:"inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer",title:"Return to model editor","data-testid":"ai-workflow-close-button"},[N(r(q),{class:"w-3.5 h-3.5"}),d[2]||(d[2]=e("span",null,"Back to editor",-1))])]),e("div",Pe,[N(Me)])]))}});export{je as default};

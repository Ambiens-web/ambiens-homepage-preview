/* Page navigation and presentation around the original Ambiens planner. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const svg = '<svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7"/></svg>';
  const esc = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const localFile=location.protocol==='file:';
  // Local files use hash routes; hosted pages keep their clean independent URLs.
  function pageURL(){
    const url=localFile?new URL(location.hash.startsWith('#/')?location.hash.slice(1):'/'+location.hash,'https://preview.ambiens.invalid'):new URL(location.href);if(url.pathname.startsWith('/ambiens-homepage-preview/'))url.pathname='/'+url.pathname.slice(26);
    if(url.pathname==='/index.html')url.pathname='/';
    return url;
  }
  function resolveURL(value){const url=new URL(localFile&&value.startsWith('#/')?value.slice(1):value,pageURL());if(url.pathname.startsWith('/ambiens-homepage-preview/'))url.pathname='/'+url.pathname.slice(26);return url;}
  function navigationURL(value){return localFile?'#'+value:'/ambiens-homepage-preview'+value;}
  function localLinks(){if(localFile)document.querySelectorAll('a[href^="/"]').forEach(a=>{const href=a.getAttribute('href');if(!href.startsWith('//'))a.setAttribute('href','#'+href)})}
  let lastRoutedURL='';
  const normal = p => p === '/' ? '/' : '/' + p.split('/').filter(Boolean).join('/') + '/';
  const allowed = new Set(CHOICES.flatMap(([,items]) => items.map(x => x[0])));
  let activeView='home', activeCategory=null, activeRoute=null, routing=false, planUsed=false, attached=false, skipAutoAttach=false;
  const snapshot=()=>({services:[...user],approval,preset,homes,used:planUsed});
  function restore(s){
    if(!s || !Array.isArray(s.services))return false;
    user=new Set(s.services.filter(id=>allowed.has(id)));
    approval=s.approval==='planning'?'planning':'exempt';
    preset=PRESETS.some(p=>p[0]===s.preset)?s.preset:null;
    homes=s.homes==='large'?'large':'small';planUsed=Boolean(s.used);return true;
  }
  function persist(){
    // Only non-personal project choices and the language are persisted.
    const state={...snapshot(),path:pageURL().pathname};
    try{sessionStorage.setItem('ambiens-plan-v1',JSON.stringify(state))}catch{}
    if(!routing)history.replaceState({...history.state,ambiens:true,plan:snapshot(),scroll:scrollY},'',location.href);
  }
  function renderCategory(path){
    const c=ROUTES[path];activeCategory=path;
    $('categoryTitle').textContent=c.title;$('categoryIntro').textContent=c.intro;
    $('categoryOptions').classList.toggle('two',c.presets.length===2);
    $('categoryOptions').innerHTML=c.presets.map(id=>{
      const p=PRESETS.find(p=>p[0]===id),im=IMG[p[5]];
      return `<a class="project-card" href="/planner/${p[0]}/"><div class="card-image"><img src="${im[0]}" alt="${esc(im[1])}" loading="lazy" width="900" height="1000"></div><div class="card-caption"><h3>${esc(p[1])}</h3>${svg}</div></a>`;
    }).join('');
  }
  // Links from a category page to the service pages under it.
  function renderCategoryLinks(path){
    $('categoryLinks').replaceChildren(...Object.entries(ROUTES).filter(([,r])=>r.service&&r.back===path).map(([href,r])=>{
      const a=document.createElement('a');a.href=href;a.textContent=r.title;return a;
    }));
  }
  // Scripts/build_pages.py writes the same content into each service page's HTML.
  function renderService(path){
    const r=ROUTES[path],d=DETAIL[r.service],image=$('svcImage');
    $('svcTitle').textContent=r.title;$('svcLead').textContent=d.lead;
    $('svcNote').textContent=r.note||'';$('svcNote').hidden=!r.note;
    if(image.getAttribute('src')!==r.image.src){image.src=r.image.src;image.width=r.image.width;image.height=r.image.height}
    image.alt=r.image.alt;
    $('svcInc').replaceChildren(...d.inc.map(text=>{const li=document.createElement('li');li.textContent=text;return li}));
    $('svcWhy').textContent=d.why;$('svcRes').textContent=d.res;$('svcWho').textContent=d.who;
    $('svcStages').replaceChildren(...r.stages.map(id=>{
      const li=document.createElement('li'),name=document.createElement('span'),weeks=document.createElement('span');
      name.textContent=M[id].n;weeks.textContent=`Approx. ${M[id].w[0]}–${M[id].w[1]} weeks`;li.append(name,weeks);return li;
    }));
    $('svcPlan').href=r.planner;
    $('svcRelated').hidden=!r.related;
    if(r.related){$('svcRelated').href=r.related[1];$('svcRelated').textContent=r.related[0]}
  }
  function renderReview(){
    const p=PRESETS.find(p=>p[0]===preset),{act}=resolve(user,approval);
    $('reviewProject').textContent=p?p[1]:'Your own plan';
    $('reviewServices').innerHTML=user.size?chipsFor(user):'<p>Nothing chosen yet</p>';
    const roles=new Map();ORDER.filter(id=>act.has(id)).forEach(id=>M[id].r.forEach(([name,type])=>{
      if(!roles.has(name))roles.set(name,{type,stages:[]});roles.get(name).stages.push(M[id].n);
    }));
    $('reviewTeam').replaceChildren(...[...roles].map(([name,{stages}])=>{
      const item=document.createElement('div'),title=document.createElement('h3'),body=document.createElement('p');
      title.textContent=name;body.textContent=stages.join(' · ');item.append(title,body);return item;
    }));
  }
  function syncAttachment(){
    $('formLanguage').value=LANG;
    // The enquiry selection wins over an older Planner attachment.
    if(attached&&typeSel.value!==(preset||'custom')){attached=false;planUsed=false;}
    $('planAttached').hidden=!attached;
    if(!attached){$('formServices').value='';$('formPlan').value='';return;}
    const {act}=resolve(user,approval),lo=schedule(act,0),hi=schedule(act,1),pr=PRESETS.find(p=>p[0]===preset);
    const services=[...user].map(id=>SHORT[id]);
    $('attachedSummary').textContent=(pr?pr[1]:'Your own plan')+' · '+services.join(', ');
    $('formServices').value=services.join(', ');
    $('formPlan').value=JSON.stringify({project:preset||'custom',projectName:pr?pr[1]:'Your own plan',services,homes:user.has('newbuild')?homes:null,stages:ORDER.filter(id=>act.has(id)).map(id=>({name:M[id].n,weeks:M[id].w,specialists:M[id].r.map(r=>r[0])})),indicativeProgrammeWeeks:[lo.e.handover,hi.e.handover],partnerSpecialists:partnerCount(act)});
  }
  function closeMenu(focus=false){
    $('head').classList.remove('menu-open');$('menuToggle').setAttribute('aria-expanded','false');
    $('menuToggle').setAttribute('data-en-aria-label','Open menu');$('menuToggle').setAttribute('aria-label',trs('Open menu'));if(focus)$('menuToggle').focus();
  }
  function breadcrumbs(items){
    $('breadcrumbs').innerHTML='<a href="/">Home</a>'+items.map(([label,path],i)=>`<span aria-hidden="true">/</span>${path?`<a href="${path}">${esc(label)}</a>`:`<span aria-current="page">${esc(label)}</span>`}`).join('');
  }
  // Sets a head tag, adding it when missing; an empty value removes it.
  function headTag(tag,key,name,value){
    let el=document.head.querySelector(`${tag}[${key}="${name}"]`);
    if(!value){el?.remove();return}
    if(!el){el=document.createElement(tag);el.setAttribute(key,name);document.head.append(el)}
    el.setAttribute(tag==='link'?'href':'content',value);
  }
  // documentTitle is English, so other languages use the translated page title (the homepage always keeps its own).
  const pageTitle=r=>(r.view==='home'||LANG==='en')&&r.documentTitle||trs(r.title)+' | Ambiens Home Design';
  function meta(r,path){
    const url=r.view==='not-found'?'':'https://ambiens.ie'+path;
    document.title=pageTitle(r);
    headTag('meta','name','description',r.description);
    headTag('meta','name','robots','noindex, nofollow, noarchive');
    
    
    
    
  }
  function route({pop=false,initial=false,restorePlan=false}={}){
    const restoredScroll=history.state?.scroll||0;
    routing=true;const here=pageURL(),path=normal(here.pathname),r=ROUTES[path]||ROUTES['*'],key=r.view;
    if(key==='category'){renderCategory(path);renderCategoryLinks(path)}
    else if(key==='service')renderService(path);
    else if(key==='review'){planUsed=true;renderReview()}
    else if(key==='planner'){planUsed=true;if(r.preset&&!restorePlan)choose(r.preset)}
    activeView=key;activeRoute=r;
    document.querySelectorAll('[data-view]').forEach(v=>v.hidden=v.dataset.view!==key);
    $('wayfinding').hidden=key==='home';$('backLink').href=r.back||'/';
    breadcrumbs([...(r.crumbs||[]),[r.title,null]]);
    document.querySelectorAll('#primaryNav a').forEach(a=>{const u=resolveURL(a.getAttribute('href')),on=!u.hash&&u.pathname===r.nav;a.classList.toggle('active',on);if(on)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
    closeMenu();setHeroActive(key==='home');
    if(key==='home'&&here.hash==='#contact'&&planUsed&&!skipAutoAttach&&typeSel.value==='unsure'){typeSel.value=preset||'custom';attached=true;syncAttachment()}
    skipAutoAttach=false;
    meta(r,path);
    localLinks();translateDOM();routing=false;lastRoutedURL=location.href;persist();
    requestAnimationFrame(()=>{
      if(here.hash){const target=document.getElementById(here.hash.slice(1));target?.scrollIntoView({behavior:initial||pop||reduce?'auto':'smooth'});}
      else{window.scrollTo({top:pop?restoredScroll:0,behavior:'instant'});}
      if(!initial&&!pop){const h=document.querySelector(`[data-view="${key}"] h1`);if(h){h.setAttribute('tabindex','-1');h.focus({preventScroll:true})}}
    });
  }
  function navigate(url){
    const target=resolveURL(url);if(target.origin!==pageURL().origin)return;
    const dest=normal(target.pathname)+target.search+target.hash;
    persist();history.pushState({ambiens:true,depth:(history.state?.depth||0)+1,plan:snapshot(),scroll:0},'',navigationURL(dest));route();
  }
  function refresh(){renderReview();if(attached)syncAttachment();localLinks();translateDOM();persist()}
  function customised(){if(activeView==='planner'){history.replaceState({...history.state,ambiens:true,plan:snapshot()},'',navigationURL('/planner/custom/'));persist();}planUsed=true;}
  function languageChanged(){
    if(activeView==='category')renderCategory(activeCategory);renderReview();syncAttachment();
    $('menuToggle').setAttribute('data-en-aria-label',$('head').classList.contains('menu-open')?'Close menu':'Open menu');$('menuToggle').setAttribute('aria-label',trs($('menuToggle').getAttribute('data-en-aria-label')));
    localLinks();translateDOM();
    const h=document.querySelector(`[data-view="${activeView}"] h1`);
    if(activeView!=='home'&&activeRoute.documentTitle)document.title=pageTitle(activeRoute);
    else if(activeView!=='home'&&h)document.title=h.textContent+' | Ambiens Home Design';
    persist();
  }
  function attachPlan(){planUsed=true;typeSel.value=preset||'custom';attached=true;syncAttachment();navigate('/#contact');}
  function prepareEstimate(){attached=false;skipAutoAttach=true;syncAttachment()}
  window.AmbiensUI={navigate,refresh,customised,languageChanged,attachPlan,prepareEstimate};
  document.addEventListener('click',e=>{
    const a=e.target.closest('a[href]');if(!a||e.defaultPrevented||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button!==0||a.target||a.hasAttribute('download'))return;
    const href=a.getAttribute('href');if(href==='#main')return;
    const u=resolveURL(href==='#contact'?'/#contact':href);if(u.origin!==pageURL().origin||!['http:','https:'].includes(u.protocol))return;
    e.preventDefault();navigate(u.href);
  });
  $('backLink').addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(history.state?.ambiens&&history.state.depth>0)history.back();else navigate($('backLink').getAttribute('href'))});
  addEventListener('popstate',e=>{const restored=restore(e.state?.plan);routing=true;update();routing=false;route({pop:true,restorePlan:restored})});
  $('menuToggle').addEventListener('click',()=>{const on=$('head').classList.toggle('menu-open');$('menuToggle').setAttribute('aria-expanded',String(on));$('menuToggle').setAttribute('data-en-aria-label',on?'Close menu':'Open menu');$('menuToggle').setAttribute('aria-label',trs(on?'Close menu':'Open menu'))});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('head').classList.contains('menu-open'))closeMenu(true)});
  $('primaryNav').addEventListener('focusout',e=>{if(!$('head').contains(e.relatedTarget))closeMenu()});
  document.querySelectorAll('[data-service-group]').forEach(root=>{
    Object.entries(DETAIL).filter(([,d])=>d.g===root.dataset.serviceGroup).forEach(([id,d])=>{
      root.append(serviceEntry(id,d));
    });
  });
  $('svcAsk').addEventListener('click',()=>askAboutService(DETAIL[activeRoute.service].t));
  $('clearAttached').addEventListener('click',()=>{attached=false;planUsed=false;syncAttachment();persist()});
  typeSel.addEventListener('change',()=>{attached=false;planUsed=false;syncAttachment();persist()});
  const form=$('enq'),note=$('enqNote'),submit=form.querySelector('[type=submit]'),submitLabel=submit.querySelector('span');
  form.addEventListener('submit',async e=>{
    e.preventDefault();note.hidden=true;note.classList.remove('error');
    const bad=Object.keys(rules).filter(n=>!check(n));if(bad.length){$('f-'+bad[0]).focus();return;}
    syncAttachment();
    if(true){
      note.textContent='Preview only: nothing was sent or saved.';note.hidden=false;translateDOM();return;
    }
    
  });
  // Restore only project choices; no name, email, phone, area or message enters storage.
  let saved=null;try{saved=JSON.parse(sessionStorage.getItem('ambiens-plan-v1')||'null')}catch{}
  const restored=restore(saved);routing=true;update();routing=false;
  let language='en';try{language=localStorage.getItem('amb-lang')||'en'}catch{}
  $('lang').value=I18N[language]?language:'en';applyLang($('lang').value);
  history.replaceState({ambiens:true,depth:history.state?.depth||0,plan:snapshot(),scroll:0},'',location.href);
  route({initial:true,restorePlan:restored&&saved.path===pageURL().pathname});
  if(localFile)addEventListener('hashchange',()=>{if(location.href!==lastRoutedURL)route({pop:true,restorePlan:true})});
})();

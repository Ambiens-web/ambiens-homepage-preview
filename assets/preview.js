/* Review build only: keeps site links inside the repository sub-path on GitHub Pages. */
(()=>{const BASE='/ambiens-homepage-preview/';
const fix=a=>{const h=a.getAttribute('href');if(h&&h.startsWith('/')&&!h.startsWith('//')&&!h.startsWith(BASE))a.setAttribute('href',BASE+h.slice(1))};
new MutationObserver(list=>list.forEach(m=>{
  if(m.type==='attributes'){if(m.target.tagName==='A')fix(m.target);return}
  m.addedNodes.forEach(n=>{if(n.tagName==='A')fix(n);n.querySelectorAll?.('a[href^="/"]').forEach(fix)});
})).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['href']});
})();

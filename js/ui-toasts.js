let root;

export function initToasts(){
  root = document.getElementById('toast-root');
  root.className = 'toast';
}

export function toast(message, type='info', {timeout=4000}={}){
  if(!root) initToasts();
  const item = document.createElement('div');
  item.className = `item ${type === 'error' ? 'error' : ''}`;
  item.role = type === 'error' ? 'alert' : 'status';
  item.textContent = message;
  root.appendChild(item);
  setTimeout(()=> item.remove(), timeout);
}

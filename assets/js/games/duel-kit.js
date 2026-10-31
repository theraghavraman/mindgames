/* Shared bits for games against the computer: levels, turn line, who starts */
(function () {
'use strict';
const MG = window.MG;
MG.duelLevels = (e, m, h) => ({
  easy: { name: 'Easy', rank: 1, desc: e }, medium: { name: 'Medium', rank: 2, desc: m }, hard: { name: 'Hard', rank: 3, desc: h },
});
MG.duelShell = cfg => {
  const api = MG.shell(Object.assign({ chapter: 'duels', metric: 'duel', timer: false, newText: 'Pick how strong the computer plays. You take turns starting.' }, cfg));
  api.mid.innerHTML = '<span class="pill" data-you>' + (cfg.youLabel || 'You') + ' <b>0</b></span><span class="pill" data-cpu>' + (cfg.cpuLabel || 'Computer') + ' <b>0</b></span>';
  api.score = (you, cpu) => { MG.qs('[data-you] b', api.mid).textContent = you; MG.qs('[data-cpu] b', api.mid).textContent = cpu; };
  api.turn = (mine, extra) => api.progress(mine ? 'Your turn' : 'The computer is thinking', extra || '', null, 0, mine ? 'turn' : 'cpu');
  let first = MG.store.get('first:' + cfg.id);
  api.nextFirst = () => { first = first === 'cpu' ? 'you' : 'cpu'; MG.store.set('first:' + cfg.id, first); return first; };
  api.think = (fn, ms = 420) => api.later(() => { if (api.status === 'playing') fn(); }, MG.reduced() ? 60 : ms);
  return api;
};
})();

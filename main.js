const { createApp, ref, computed, onMounted, watch } = Vue;

createApp({
  setup(){
    const games = ref([]);
    const selectedGame = ref(null);
    const playerCount = ref(2);
    const players = ref([]); // array of objects {id, name}
    const scores = ref({}); // structure: scores[roundIndex][playerId][fieldKey] = number
    const firstPlayer = ref('');
    const history = ref([]);
    const currentView = ref('score'); // score, history, editor

    // rounds control
    const roundsCount = ref(1);
    const activeRound = ref(0); // 0-indexed

    // editor
    const newGameName = ref('');
    const newGameFields = ref(['']);

    // load games and history
    const loadGames = async () => {
      try{
        const res = await fetch('games.json');
        const baseGames = await res.json();
        const custom = JSON.parse(localStorage.getItem('customGames') || '[]');
        games.value = [...baseGames, ...custom];
      }catch(e){
        console.error(e);
        games.value = JSON.parse(localStorage.getItem('customGames') || '[]');
      }
    };

    onMounted(()=>{
      loadGames();
      history.value = JSON.parse(localStorage.getItem('history') || '[]');
    });

    // create player objects
    const startGame = () => {
      if(!selectedGame.value) return alert('Choose a game first');
      // determine rounds
      if(selectedGame.value.rounds){
        roundsCount.value = selectedGame.value.roundsDefault || 1;
      }else{
        roundsCount.value = 1;
      }
      // init players
      players.value = Array.from({length: playerCount.value}, (_,i)=>({id: Math.random().toString(36).slice(2,9), name: `Player ${i+1}`}));
      // init scores structure
      scores.value = {};
      for(let r=0;r<roundsCount.value;r++){
        scores.value[r] = {};
        players.value.forEach(p => {
          scores.value[r][p.id] = {};
          selectedGame.value.scoringFields.forEach(f => scores.value[r][p.id][f.key] = 0);
        });
      }
      activeRound.value = 0;
      pickFirstPlayer();
    };

    const pickFirstPlayer = () => {
      if(players.value.length===0) return;
      const i = Math.floor(Math.random() * players.value.length);
      firstPlayer.value = players.value[i].name;
    };

    const setPlayerName = (playerId, newName) => {
      const p = players.value.find(x=>x.id===playerId);
      if(p) p.name = newName;
    };

    const roundLabel = (i) => {
      return selectedGame.value && selectedGame.value.rounds ? `Round ${i+1}` : `Final`;
    };

    const totalForPlayer = (playerId) => {
      let total = 0;
      Object.keys(scores.value).forEach(rk => {
        const round = scores.value[rk];
        const pRound = round[playerId];
        if(!pRound) return;
        Object.values(pRound).forEach(v => total += Number(v) || 0);
      });
      return total;
    };

    const totalsThisRound = computed(()=>{
      if(!scores.value[activeRound.value]) return [];
      return players.value.map(p=>({player:p, total: Object.values(scores.value[activeRound.value][p.id]||{}).reduce((a,b)=>a+(Number(b)||0),0)})).sort((a,b)=>b.total-a.total);
    });

    const overallStandings = computed(()=>{
      return players.value.map(p=>({player:p, total: totalForPlayer(p.id)})).sort((a,b)=>b.total-a.total);
    });

    const saveGameToHistory = () => {
      if(!selectedGame.value) return;
      const rec = {
        id: Math.random().toString(36).slice(2,9),
        date: new Date().toISOString(),
        game: selectedGame.value.name,
        rounds: roundsCount.value,
        roundDetails: [], // per round list of player scores by field and totals
        players: players.value.map(p=>({id:p.id, name:p.name}))
      };
      for(let r=0;r<roundsCount.value;r++){
        const roundObj = { round: r+1, players: [] };
        players.value.forEach(p=>{
          const fields = scores.value[r][p.id];
          const total = Object.values(fields).reduce((a,b)=>a+(Number(b)||0),0);
          roundObj.players.push({id:p.id, name:p.name, fields: {...fields}, total});
        });
        rec.roundDetails.push(roundObj);
      }
      history.value.unshift(rec);
      localStorage.setItem('history', JSON.stringify(history.value));
      alert('Saved to history.');
    };

    const deleteHistory = (id)=>{
      if(!confirm('Delete this history entry?')) return;
      history.value = history.value.filter(h=>h.id!==id);
      localStorage.setItem('history', JSON.stringify(history.value));
    };

    const clearHistory = ()=>{
      if(!confirm('Clear all history?')) return;
      history.value=[];
      localStorage.removeItem('history');
    };

    const addNewGame = ()=>{
      const name = newGameName.value.trim();
      const fields = newGameFields.value.map(f=>f.trim()).filter(Boolean);
      if(!name || fields.length===0) return alert('Add name and at least one field');
      const game = { name, rounds: false, roundsDefault:1, scoringFields: fields.map(k=>({key:k.toLowerCase().replace(/\s+/g,'_'), label:k, helper:''})) };
      const stored = JSON.parse(localStorage.getItem('customGames') || '[]');
      stored.push(game);
      localStorage.setItem('customGames', JSON.stringify(stored));
      loadGames();
      newGameName.value=''; newGameFields.value=[''];
      alert('Game saved.');
    };

    // watch selectedGame to update roundsCount default
    watch(selectedGame, (g)=>{
      if(!g) return;
      if(g.rounds) roundsCount.value = g.roundsDefault || 1;
      else roundsCount.value = 1;
    });

    return {
      games, selectedGame, playerCount, players, scores, firstPlayer, history, currentView,
      roundsCount, activeRound, startGame, pickFirstPlayer, setPlayerName, roundLabel,
      totalsThisRound, overallStandings, saveGameToHistory, deleteHistory, clearHistory,
      newGameName, newGameFields, addNewGame
    };
  },

  template: `
    <div>
      <div class="header">
        <div class="logo">FS</div>
        <div>
          <h1>Fantasy Board Scorer — Final</h1>
          <div class="small">Round-by-round scoring • editable player names • game-specific helpers</div>
        </div>
      </div>

      <div class="controls">
        <button class="primary" @click="currentView='score'">🏰 Score Game</button>
        <button @click="currentView='history'">📜 History</button>
        <button @click="currentView='editor'">🛠 Game Editor</button>
      </div>

      <div v-if="currentView==='score'">
        <div class="card">
          <label class="small">Select Game</label>
          <select v-model="selectedGame">
            <option disabled value="">-- choose a quest --</option>
            <option v-for="g in games" :key="g.name" :value="g">{{ g.name }}</option>
          </select>

          <div style="margin-top:10px" class="grid">
            <div>
              <label class="small">Player Count</label>
              <input type="number" v-model.number="playerCount" min="1" max="8" />
            </div>
            <div v-if="selectedGame">
              <label class="small">Rounds</label>
              <input type="number" v-model.number="roundsCount" :min="1" :max="12" />
              <div class="small">Tip: change rounds if the game has a different number of rounds.</div>
            </div>
          </div>

          <div style="margin-top:12px">
            <button class="primary" @click="startGame">Begin Quest</button>
          </div>
        </div>

        <div v-if="players.length">
          <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div><strong>First Player:</strong> {{ firstPlayer }}</div>
              <div class="round-tab">
                <button v-for="n in roundsCount" :key="n" :class="['round-button', {active: activeRound===n-1}]" @click="activeRound=n-1">{{ 'R'+n }}</button>
              </div>
            </div>

            <div style="margin-top:12px">
              <div v-for="p in players" :key="p.id" style="margin-bottom:10px" class="card">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
                  <div style="display:flex;gap:8px;align-items:center">
                    <input class="player-name" v-model="p.name" @input="setPlayerName(p.id, p.name)" />
                    <div class="small">Overall: {{ overallStandings.find(o=>o.player.id===p.id)?.total || 0 }} pts</div>
                  </div>
                  <div class="small">Round {{ activeRound+1 }} Total: {{ totalsThisRound.find(t=>t.player.id===p.id)?.total || 0 }} pts</div>
                </div>

                <div style="margin-top:8px">
                  <div v-for="field in selectedGame.scoringFields" :key="field.key" class="field-row">
                    <div style="flex:1">
                      <div>{{ field.label }}</div>
                      <div class="helper">{{ field.helper }}</div>
                    </div>
                    <div style="width:140px">
                      <input type="number" v-model.number="scores[activeRound][p.id][field.key]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style="display:flex;gap:8px;margin-top:8px">
              <button class="primary" @click="saveGameToHistory">📜 Save Game (with rounds)</button>
              <button @click="players=[]">End Session</button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="currentView==='history'">
        <div class="card">
          <h3>Game History</h3>
          <div style="display:flex;gap:8px;margin-bottom:8px">
            <button @click="clearHistory">Clear All</button>
          </div>
          <div v-if="history.length===0" class="small">No games yet.</div>
          <ul style="list-style:none;padding:0;margin:0">
            <li v-for="h in history" :key="h.id" class="card" style="margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <div>
                  <div><strong>{{ h.game }}</strong> <span class="small">— {{ new Date(h.date).toLocaleString() }}</span></div>
                  <div class="small">Rounds: {{ h.rounds }}</div>
                </div>
                <div>
                  <button @click="deleteHistory(h.id)">Delete</button>
                </div>
              </div>
              <div style="margin-top:8px">
                <div v-for="rd in h.roundDetails">
                  <div class="small"><strong>Round {{ rd.round }}</strong></div>
                  <ol>
                    <li v-for="p in rd.players">{{ p.name }} — {{ p.total }} pts</li>
                  </ol>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <div v-if="currentView==='editor'">
        <div class="card">
          <h3>Game Editor — Quick Add</h3>
          <div style="margin-bottom:8px">
            <label class="small">Game Name</label>
            <input v-model="newGameName" placeholder="e.g. My Custom Game"/>
          </div>
          <div style="margin-bottom:8px">
            <label class="small">Scoring Categories</label>
            <div v-for="(f,i) in newGameFields" :key="i" style="display:flex;gap:8px;margin-bottom:8px">
              <input v-model="newGameFields[i]" placeholder="Category name"/>
              <button @click="newGameFields.splice(i,1)">Remove</button>
            </div>
            <button @click="newGameFields.push('')">+ Add category</button>
          </div>
          <div style="display:flex;gap:8px">
            <button class="primary" @click="addNewGame">Save Game</button>
          </div>
        </div>
      </div>

      <div class="footer small">Tip: Add to Home Screen for offline use.</div>
    </div>
  `
}).mount('#app');

const { createApp, ref, computed, onMounted } = Vue;

createApp({
  setup() {
    const games = ref([]);
    const selectedGame = ref(null);
    const playerCount = ref(2);
    const players = ref([]);
    const scores = ref({});
    const firstPlayer = ref("");

    onMounted(async () => {
      const res = await fetch("games.json");
      games.value = await res.json();
    });

    const startGame = () => {
      players.value = Array.from({ length: playerCount.value }, (_, i) => `Player ${i + 1}`);
      scores.value = {};
      players.value.forEach(p => scores.value[p] = {});
      pickFirstPlayer();
    };

    const pickFirstPlayer = () => {
      const randomIndex = Math.floor(Math.random() * players.value.length);
      firstPlayer.value = players.value[randomIndex];
    };

    const totalScores = computed(() => {
      return players.value.map(p => {
        const total = Object.values(scores.value[p]).reduce((a, b) => a + (Number(b) || 0), 0);
        return { player: p, total };
      });
    });

    return {
      games, selectedGame, playerCount, players,
      scores, firstPlayer, startGame, pickFirstPlayer, totalScores
    };
  },

  template: `
    <div>
      <h1>🧙‍♂️ Fantasy Board Game Scorer</h1>

      <label>Select Game:</label>
      <select v-model="selectedGame">
        <option disabled value="">-- Choose --</option>
        <option v-for="game in games" :key="game.name" :value="game">{{ game.name }}</option>
      </select>

      <label>Player Count:</label>
      <input type="number" v-model="playerCount" min="2" max="8" />

      <button @click="startGame">Begin Quest</button>

      <div v-if="players.length">
        <p><strong>Chosen One to Begin:</strong> {{ firstPlayer }}</p>
        <button @click="pickFirstPlayer">Invoke Fate Again</button>

        <div v-for="player in players" :key="player">
          <h3>🏰 {{ player }}</h3>
          <div v-for="field in selectedGame.scoringFields" :key="field">
            <label>{{ field }}:</label>
            <input type="number" v-model="scores[player][field]" />
          </div>
        </div>

        <h2>Final Standings</h2>
        <ul>
          <li v-for="score in totalScores" :key="score.player">
            🏆 {{ score.player }}: {{ score.total }} pts
          </li>
        </ul>
      </div>
    </div>
  `
}).mount('#app');

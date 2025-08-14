import { useEffect, useState } from "react";
import { db } from "./firebase";
import { doc, getDoc, setDoc, updateDoc, increment } from "firebase/firestore";

export default function App() {
  const [coins, setCoins] = useState(0);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    // Get user_id from URL
    const params = new URLSearchParams(window.location.search);
    const id = params.get("user_id");
    setUserId(id);

    if (id) {
      loadUser(id);
    }
  }, []);

  async function loadUser(id) {
    const ref = doc(db, "users", id);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      setCoins(snap.data().coins || 0);
    } else {
      // Create user in DB
      await setDoc(ref, { coins: 0 });
    }
  }

  async function addCoin() {
    if (!userId) return;
    const ref = doc(db, "users", userId);
    await updateDoc(ref, { coins: increment(1) });
    setCoins(prev => prev + 1);
  }

  return (
    <div style={{ textAlign: "center", marginTop: 50 }}>
      <h1>🚀 Telegram Mini App</h1>
      <p>User ID: {userId}</p>
      <h2>Coins: {coins}</h2>
      <button
        style={{
          padding: "10px 20px",
          fontSize: "16px",
          background: "blue",
          color: "white",
          border: "none",
          borderRadius: "5px"
        }}
        onClick={addCoin}
      >
        +1 Coin
      </button>
    </div>
  );
}

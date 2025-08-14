import { useEffect, useState } from "react";
import { db, auth } from "./firebase";
import { signInWithCustomToken } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, increment } from "firebase/firestore";

export default function App() {
  const [coins, setCoins] = useState(0);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (token) {
      // Sign in with Firebase custom token
      signInWithCustomToken(auth, token)
        .then(userCredential => {
          const uid = userCredential.user.uid;
          setUserId(uid);
          loadUser(uid);
        })
        .catch(error => console.error("Auth error:", error));
    }
  }, []);

  async function loadUser(id) {
    try {
      const ref = doc(db, "users", id);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        setCoins(snap.data().coins || 0);
      } else {
        await setDoc(ref, { coins: 0 });
        setCoins(0); // Ensure UI updates for new users
      }
    } catch (err) {
      console.error("Firestore error:", err);
    }
  }

  async function addCoin() {
    if (!userId) return;
    try {
      const ref = doc(db, "users", userId);
      await updateDoc(ref, { coins: increment(1) });
      setCoins(prev => prev + 1);
    } catch (err) {
      console.error("Add coin error:", err);
    }
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
        disabled={!userId}
      >
        +1 Coin
      </button>
    </div>
  );
}
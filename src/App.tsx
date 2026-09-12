import React, { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import { useGameStore } from './store';
import { Map } from './components/Map';
import { Players } from './components/Players';
import { LocalPlayer } from './components/LocalPlayer';
import { AttackEffects } from './components/AttackEffects';
import { MobileControls } from './components/MobileControls';
import { EliminatedModal, SpectateHUD } from './components/EliminatedModal';
import { FirebaseAccount } from './components/FirebaseAccount';
import { auth, updateUserStats, UserProfileData } from './firebase';
import { CharacterClass } from './types';
import { RotateCcw, LogOut, Trophy, Flame } from 'lucide-react';

export default function App() {
  const connect = useGameStore((s) => s.connect);
  const leaveGame = useGameStore((s) => s.leaveGame);
  const myId = useGameStore((s) => s.myId);
  const gameState = useGameStore((s) => s.gameState);
  const socket = useGameStore((s) => s.socket);
  const [hasStarted, setHasStarted] = useState(false);
  const [mode, setMode] = useState<'casual'|'ranked'|'password'|'team'|'bot'>('bot');
  const [password, setPassword] = useState('');
  const [charClass, setCharClass] = useState<CharacterClass>('melee');
  const [lastProcessedMatch, setLastProcessedMatch] = useState<string | null>(null);
  const [cloudProfile, setCloudProfile] = useState<UserProfileData | null>(null);

  const [profile, setProfile] = useState(() => {
    const p = localStorage.getItem('poly_profile');
    if (p) return JSON.parse(p);
    return { wins: 0, streak: 0, rankPoints: 0, rating: null };
  });

  const handleReturnToLobby = () => {
    leaveGame();
    setHasStarted(false);
  };

  const handlePlayAgain = () => {
    leaveGame();
    setTimeout(() => {
      connect(mode, password, charClass);
      setHasStarted(true);
    }, 120);
  };

  // Process Match End logic - ONLY Ranked Mode updates Rating & Rank Points
  useEffect(() => {
    if (gameState?.status === 'ended' && gameState.roomId !== lastProcessedMatch) {
      setLastProcessedMatch(gameState.roomId);
      const myPlayer = gameState.players[myId!];
      
      const isWin = gameState.winner === myId || (myPlayer?.team && gameState.winner === myPlayer.team);
      const myScore = myPlayer?.score || 0;
      let newProfile = { ...profile };

      if (isWin) {
        newProfile.wins += 1;
        newProfile.streak += 1;
      } else {
        newProfile.streak = 0;
      }

      
      let ratingChange = 0;
      // STRICT RULE: Only modify rank points and rating in RANKED match mode!
      if (gameState.mode === 'ranked') {
        if (isWin) {
          // Much harder progression: +12 base + 2 per kill + small streak bonus
          const killBonus = Math.min(6, myScore * 2);
          const streakBonus = Math.min(3, newProfile.streak);
          const pointsEarned = 12 + killBonus + streakBonus;
          
          let ratingBefore = newProfile.rating !== null ? newProfile.rating : newProfile.rankPoints;

          if (newProfile.rating === null) {
            ratingChange = pointsEarned;
            newProfile.rankPoints += pointsEarned;
            if (newProfile.rankPoints >= 2000) {
              newProfile.rating = 2000.000 + (newProfile.streak * 5);
            }
          } else {
            // God tier rate increments slowly
            ratingChange = 5.2 + Math.min(3, myScore) + Math.min(3, newProfile.streak * 0.5);
            newProfile.rating += ratingChange;
          }
        } else {
          // Defeat penalty in Ranked Mode
          
          if (newProfile.rating !== null) {
            ratingChange = Math.max(2000, newProfile.rating - 7.5) - newProfile.rating;
            newProfile.rating = Math.max(2000, newProfile.rating - 7.5);
          } else {
            ratingChange = Math.max(0, newProfile.rankPoints - 8) - newProfile.rankPoints;
            newProfile.rankPoints = Math.max(0, newProfile.rankPoints - 8);
          }
        }
      }

      setProfile(newProfile);
      localStorage.setItem('poly_profile', JSON.stringify(newProfile));

      // Sync stats to Firebase Firestore if logged in
      if (auth.currentUser) {
        const deaths = isWin ? 0 : 1;
        const currentRating = newProfile.rating !== null ? newProfile.rating : newProfile.rankPoints;
        updateUserStats(
          auth.currentUser.uid,
          isWin,
          myScore,
          deaths,
          charClass,
          typeof ratingChange !== 'undefined' ? ratingChange : 0,
          currentRating,
          gameState.mode
        ).catch((err) => console.error('Error syncing match to Firebase:', err));
      }
    }
  }, [gameState?.status, gameState?.roomId, gameState?.winner]);

  const getRankName = (points: number, rating: number | null) => {
    if (rating !== null) return `God`;
    if (points < 150) return 'Beginner';
    if (points < 300) return 'Bronze';
    if (points < 500) return 'Silver';
    if (points < 750) return 'Gold';
    if (points < 1000) return 'Platinum';
    if (points < 1300) return 'Diamond';
    if (points < 1650) return 'Master';
    if (points < 2000) return 'GrandMaster';
    return `God`;
  };

  const rankName = getRankName(profile.rankPoints, profile.rating);
  const displayRate = profile.rating !== null ? profile.rating.toFixed(3) : profile.rankPoints;

  const handleJoin = () => {
    connect(mode, password, charClass);
    setHasStarted(true);
  };

  if (!hasStarted) {
    return (
      <div className="flex flex-col items-center justify-start sm:justify-center min-h-screen max-h-screen overflow-y-auto bg-slate-900 text-white font-sans touch-pan-y select-none px-4 py-6 sm:py-8 text-center">
        <h1 className="text-4xl sm:text-6xl font-black mb-1 sm:mb-2 text-blue-400 drop-shadow-lg">POLY ROYALE</h1>
        <div className="text-sm sm:text-lg font-bold text-yellow-400 mb-4 sm:mb-6 bg-black/30 px-4 sm:px-6 py-1.5 sm:py-2 rounded-full border border-yellow-500/30">
          Rank: {rankName} (Rate: {displayRate})
        </div>

        <FirebaseAccount onUserLoaded={setCloudProfile} />
        
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-2 max-w-3xl">
          <button 
            onClick={() => setMode('bot')} 
            className={`px-3.5 sm:px-5 py-2 sm:py-3 rounded-xl font-black text-sm sm:text-lg transition-all shadow-lg flex items-center gap-1.5 sm:gap-2 ${
              mode === 'bot' 
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white ring-2 ring-purple-300 scale-105' 
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <span>🤖</span> Bot戦 (AI Solo)
          </button>
          <button 
            onClick={() => setMode('casual')} 
            className={`px-3.5 sm:px-5 py-2 sm:py-3 rounded-xl font-bold text-sm sm:text-lg transition-colors ${
              mode === 'casual' ? 'bg-blue-500 text-white ring-2 ring-blue-300' : 'bg-slate-700 text-slate-300'
            }`}
          >
            Casual Match
          </button>
          <button 
            onClick={() => setMode('team')} 
            className={`px-3.5 sm:px-5 py-2 sm:py-3 rounded-xl font-bold text-sm sm:text-lg transition-colors ${
              mode === 'team' ? 'bg-teal-500 text-white ring-2 ring-teal-300' : 'bg-slate-700 text-slate-300'
            }`}
          >
            Team Battle
          </button>
          <button 
            onClick={() => setMode('ranked')} 
            className={`px-3.5 sm:px-5 py-2 sm:py-3 rounded-xl font-bold text-sm sm:text-lg transition-colors ${
              mode === 'ranked' ? 'bg-orange-500 text-white ring-2 ring-orange-300' : 'bg-slate-700 text-slate-300'
            }`}
          >
            Ranked Match
          </button>
          <button 
            onClick={() => setMode('password')} 
            className={`px-3.5 sm:px-5 py-2 sm:py-3 rounded-xl font-bold text-sm sm:text-lg transition-colors ${
              mode === 'password' ? 'bg-purple-500 text-white ring-2 ring-purple-300' : 'bg-slate-700 text-slate-300'
            }`}
          >
            Password Match
          </button>
        </div>

        {/* Mode subtitle explanation */}
        <div className="text-[11px] sm:text-xs text-slate-400 font-medium mb-3 sm:mb-4 min-h-4 flex items-center justify-center">
          {mode === 'bot' && '🤖 待ち時間なし！15体の自律型AI Botと大乱闘バトルロイヤル'}
          {mode === 'casual' && '⚔️ オンラインの他プレイヤーと通常マッチング'}
          {mode === 'team' && '🛡️ 赤チーム vs 青チームの陣営対抗デスマッチ'}
          {mode === 'ranked' && '🏆 勝敗でレートが増減する本格ランクバトル'}
          {mode === 'password' && '🔒 合言葉を設定してフレンド同士でプライベート対戦'}
        </div>

        {mode === 'password' && (
          <input 
            type="text" 
            placeholder="Enter Room Password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-4 px-4 sm:px-6 py-2 sm:py-3 rounded-xl text-black font-bold text-base sm:text-lg text-center w-60 sm:w-64 focus:outline-none focus:ring-4 focus:ring-purple-500"
          />
        )}

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap justify-center gap-2 sm:gap-4 mb-4 sm:mb-8 w-full max-w-4xl">
          <button onClick={() => setCharClass('melee')} className={`px-3 sm:px-4 py-2 sm:py-3 rounded-xl font-bold transition-colors ${charClass === 'melee' ? 'bg-blue-600 text-white border-2 border-blue-400' : 'bg-slate-800 text-slate-400 border-2 border-transparent hover:bg-slate-700'}`}>
            <div className="text-base sm:text-xl mb-0.5 sm:mb-1">近接兵 (Assault)</div>
            <div className="text-[11px] sm:text-xs opacity-80">Balanced (100 HP)</div>
            <div className="text-[9px] sm:text-[10px] text-blue-200 mt-0.5 sm:mt-1">爆弾投擲 (Bomb)</div>
          </button>
          <button onClick={() => setCharClass('sword')} className={`px-3 sm:px-4 py-2 sm:py-3 rounded-xl font-bold transition-colors ${charClass === 'sword' ? 'bg-red-600 text-white border-2 border-red-400' : 'bg-slate-800 text-slate-400 border-2 border-transparent hover:bg-slate-700'}`}>
            <div className="text-base sm:text-xl mb-0.5 sm:mb-1">剣豪 (Blade)</div>
            <div className="text-[11px] sm:text-xs opacity-80">Melee (90 HP)</div>
            <div className="text-[9px] sm:text-[10px] text-red-200 mt-0.5 sm:mt-1">無敵ダッシュ (Invuln)</div>
          </button>
          <button onClick={() => setCharClass('tank')} className={`px-3 sm:px-4 py-2 sm:py-3 rounded-xl font-bold transition-colors ${charClass === 'tank' ? 'bg-yellow-600 text-white border-2 border-yellow-400' : 'bg-slate-800 text-slate-400 border-2 border-transparent hover:bg-slate-700'}`}>
            <div className="text-base sm:text-xl mb-0.5 sm:mb-1">Tank</div>
            <div className="text-[11px] sm:text-xs opacity-80">Heavy (150 HP)</div>
            <div className="text-[9px] sm:text-[10px] text-yellow-200 mt-0.5 sm:mt-1">防御シールド (Shield)</div>
          </button>
          <button onClick={() => setCharClass('scout')} className={`px-3 sm:px-4 py-2 sm:py-3 rounded-xl font-bold transition-colors ${charClass === 'scout' ? 'bg-green-600 text-white border-2 border-green-400' : 'bg-slate-800 text-slate-400 border-2 border-transparent hover:bg-slate-700'}`}>
            <div className="text-base sm:text-xl mb-0.5 sm:mb-1">奇襲兵 (Scout)</div>
            <div className="text-[11px] sm:text-xs opacity-80">Fast (35 HP)</div>
            <div className="text-[9px] sm:text-[10px] text-green-200 mt-0.5 sm:mt-1">飛行 (Fly)</div>
          </button>
        </div>

        <button 
          onClick={handleJoin}
          className="w-full max-w-xs sm:w-auto px-8 sm:px-12 py-3 sm:py-4 bg-yellow-400 text-black font-black text-2xl sm:text-3xl rounded-xl hover:bg-yellow-300 active:scale-95 transition-all shadow-xl mb-4"
        >
          JOIN GAME
        </button>
      </div>
    );
  }

  if (!myId || !gameState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white font-sans touch-none select-none">
        <h1 className="text-3xl font-bold animate-pulse text-blue-400">Connecting...</h1>
      </div>
    );
  }

  const myPlayer = gameState.players[myId];
  const isWaiting = gameState.status === 'waiting';
  const isEnded = gameState.status === 'ended';

  return (
    <div className="w-screen h-screen overflow-hidden bg-sky-200 touch-none select-none">
      <Canvas shadows camera={{ fov: 75 }}>
        <Sky sunPosition={[100, 20, 100]} />
        <ambientLight intensity={0.5} />
        <directionalLight 
          castShadow 
          position={[50, 100, 50]} 
          intensity={1.5} 
          shadow-mapSize={[1024, 1024]} 
          shadow-camera-left={-100}
          shadow-camera-right={100}
          shadow-camera-top={100}
          shadow-camera-bottom={-100}
        />
        <Map />
        <Players />
        <LocalPlayer />
        <AttackEffects />
      </Canvas>

      <MobileControls />

      {/* Matchmaking Lobby UI */}
      {isWaiting && (
        <div className="absolute top-20 left-0 right-0 flex justify-center pointer-events-none z-20">
          <div className="bg-black/60 text-white px-8 py-4 rounded-full font-bold text-xl backdrop-blur-md flex flex-col items-center gap-1">
            <div className="text-sm text-slate-300 uppercase tracking-widest">
              {gameState.mode} MATCH 
              {gameState.mode === 'password' && ` - Room: ${gameState.roomId}`}
            </div>
            <div>Waiting for players... {Math.ceil(gameState.matchTimer)}s</div>
          </div>
        </div>
      )}

      {/* End Match UI */}
      {isEnded && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-md text-white pointer-events-auto p-4 select-none touch-none">
          <div className="w-full max-w-md bg-slate-900/95 border-2 border-yellow-500/40 rounded-3xl p-6 md:p-8 shadow-[0_0_50px_rgba(234,179,8,0.25)] text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-yellow-500/20 border border-yellow-500/50 flex items-center justify-center text-yellow-400 mb-3 shadow-[0_0_20px_rgba(234,179,8,0.4)]">
              <Trophy size={36} className="animate-bounce" />
            </div>

            <h1 className="text-4xl md:text-5xl font-black text-yellow-400 mb-1 drop-shadow tracking-wider">
              {gameState.winner === myId ? 'VICTORY ROYALE!' : 'MATCH OVER'}
            </h1>
            
            <p className="text-slate-400 text-sm font-semibold mb-6">
              {gameState.winner === myId ? '見事最後まで生き残りました！' : '試合が終了しました'}
            </p>

            <div className="bg-slate-800/80 w-full rounded-2xl p-4 mb-6 border border-white/5 flex justify-around items-center">
              <div>
                <div className="text-[11px] text-slate-400 font-bold uppercase">スコア</div>
                <div className="text-2xl font-black text-amber-300">{myPlayer?.score || 0}</div>
              </div>
              <div className="border-l border-white/10 h-8" />
              <div>
                <div className="text-[11px] text-slate-400 font-bold uppercase">次の試合</div>
                <div className="text-2xl font-black text-blue-400">{Math.ceil(gameState.matchTimer)}秒</div>
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full">
              <button
                type="button"
                onClick={handlePlayAgain}
                className="w-full py-4 bg-yellow-400 hover:bg-yellow-300 active:scale-98 text-slate-950 font-black text-lg rounded-2xl shadow-lg shadow-yellow-400/30 flex items-center justify-center gap-2 transition-all"
              >
                <RotateCcw size={22} className="stroke-[2.5]" />
                <span>次マッチに参戦</span>
              </button>

              <button
                type="button"
                onClick={handleReturnToLobby}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-300 font-bold text-base rounded-2xl border border-white/10 flex items-center justify-center gap-2 transition-all"
              >
                <LogOut size={18} />
                <span>ロビーに戻る</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Elimination Modal & Spectate HUD (when eliminated during playing) */}
      {!isEnded && myPlayer?.isDead && (
        <>
          <EliminatedModal onReturnToLobby={handleReturnToLobby} onPlayAgain={handlePlayAgain} />
          <SpectateHUD onReturnToLobby={handleReturnToLobby} />
        </>
      )}
    </div>
  );
}

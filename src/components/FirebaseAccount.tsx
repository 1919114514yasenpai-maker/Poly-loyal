import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  auth,
  loginWithGoogle,
  logoutUser,
  loadOrCreateUserProfile,
  fetchTopLeaderboard,
  UserProfileData,
  LeaderboardEntryData,
} from '../firebase';
import { Trophy, LogIn, LogOut, Shield, Award, UserCheck, X, Activity, BarChart2 } from 'lucide-react';
import { fetchUserHistory, MatchHistoryData } from '../firebase';

function RatingHistoryChart({ history }: { history: MatchHistoryData[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const data = [...history].reverse();
  if (data.length === 0) return null;

  const width = 560;
  const height = 180;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 25;

  const ratings = data.map(d => d.newRating);
  const minRating = Math.max(0, Math.min(...ratings) - 40);
  const maxRating = Math.max(...ratings) + 40;
  const range = maxRating - minRating || 1;

  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;

  const points = data.map((d, i) => {
    const x = padLeft + (data.length > 1 ? (i / (data.length - 1)) * chartWidth : chartWidth / 2);
    const y = padTop + chartHeight - ((d.newRating - minRating) / range) * chartHeight;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(padTop + chartHeight).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padTop + chartHeight).toFixed(1)} Z`;

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : points[points.length - 1];

  const gridSteps = [
    { rating: maxRating, y: padTop },
    { rating: Math.round((minRating + maxRating) / 2), y: padTop + chartHeight / 2 },
    { rating: minRating, y: padTop + chartHeight },
  ];

  return (
    <div className="relative w-full select-none">
      {activePoint && (
        <div className="flex items-center justify-between text-xs mb-1 px-1">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Match #{points.indexOf(activePoint) + 1}</span>
            <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${activePoint.placement === 1 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-700 text-slate-300'}`}>
              {activePoint.placement === 1 ? '👑 Victory' : `#${activePoint.placement} Place`}
            </span>
            <span className="text-slate-400">⚔️ {activePoint.kills} kills</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Rating:</span>
            <span className="font-black text-purple-400 text-sm">{activePoint.newRating.toFixed(0)}</span>
            <span className={`text-[11px] font-bold ${activePoint.ratingChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              ({activePoint.ratingChange >= 0 ? `+${activePoint.ratingChange.toFixed(0)}` : activePoint.ratingChange.toFixed(0)})
            </span>
          </div>
        </div>
      )}

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-44 overflow-visible"
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <defs>
          <linearGradient id="ratingGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {gridSteps.map((step, idx) => (
          <g key={idx}>
            <line
              x1={padLeft}
              y1={step.y}
              x2={width - padRight}
              y2={step.y}
              stroke="#334155"
              strokeDasharray={idx === 1 ? '4 4' : undefined}
              strokeWidth="1"
            />
            <text
              x={padLeft - 8}
              y={step.y + 4}
              textAnchor="end"
              fill="#94a3b8"
              fontSize="11"
              fontFamily="sans-serif"
            >
              {step.rating.toFixed(0)}
            </text>
          </g>
        ))}

        <path d={areaPath} fill="url(#ratingGrad)" />

        <path
          d={linePath}
          fill="none"
          stroke="#a855f7"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {activePoint && (
          <line
            x1={activePoint.x}
            y1={padTop}
            x2={activePoint.x}
            y2={padTop + chartHeight}
            stroke="#c084fc"
            strokeDasharray="3 3"
            strokeWidth="1.5"
          />
        )}

        {points.map((p, i) => (
          <g
            key={i}
            className="cursor-pointer"
            onMouseEnter={() => setHoveredIdx(i)}
          >
            <circle cx={p.x} cy={p.y} r="14" fill="transparent" />
            <circle
              cx={p.x}
              cy={p.y}
              r={hoveredIdx === i ? 6 : (points.length <= 15 ? 4 : 2.5)}
              fill={hoveredIdx === i ? '#ffffff' : '#a855f7'}
              stroke="#9333ea"
              strokeWidth={hoveredIdx === i ? 3 : 1.5}
              className="transition-all duration-150"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

interface Props {
  onUserLoaded?: (profile: UserProfileData | null) => void;
}

export function FirebaseAccount({ onUserLoaded }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntryData[]>([]);
  const [isLoadingLb, setIsLoadingLb] = useState(false);
  
  const [showProfile, setShowProfile] = useState(false);
  const [history, setHistory] = useState<MatchHistoryData[]>([]);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userProfile = await loadOrCreateUserProfile(currentUser);
          setProfile(userProfile);
          onUserLoaded?.(userProfile);
        } catch (err) {
          console.error('Failed to load user profile:', err);
        }
      } else {
        setProfile(null);
        onUserLoaded?.(null);
      }
      setIsLoading(false);
    });

    return () => unsub();
  }, [onUserLoaded]);

  const handleLogin = async () => {
    setIsLoading(true);
    await loginWithGoogle();
    setIsLoading(false);
  };

  const handleLogout = async () => {
    await logoutUser();
  };

  const openProfile = async () => {
    setShowProfile(true);
    setIsLoadingProfile(true);
    try {
      if (user) {
        const h = await fetchUserHistory(user.uid);
        setHistory(h || []);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const openLeaderboard = async () => {
    setShowLeaderboard(true);
    setIsLoadingLb(true);
    try {
      const entries = await fetchTopLeaderboard();
      setLeaderboard(entries);
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    } finally {
      setIsLoadingLb(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto mb-6 px-4">
      {/* Top Banner Bar */}
      <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xl">
        {user ? (
          <div className="flex items-center gap-3">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'Player'}
                className="w-10 h-10 rounded-full border-2 border-yellow-400 object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white border-2 border-yellow-400">
                {(user.displayName || 'P')[0].toUpperCase()}
              </div>
            )}
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white text-sm">
                  {profile?.displayName || user.displayName || 'Player'}
                </span>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-500/30 flex items-center gap-0.5">
                  <UserCheck size={10} /> Cloud Synced
                </span>
              </div>
              <div className="text-xs text-slate-300 flex items-center gap-2 mt-0.5">
                <span>🏆 Wins: <strong className="text-yellow-400">{profile?.totalWins ?? 0}</strong></span>
                <span>⚔️ Kills: <strong className="text-red-400">{profile?.totalKills ?? 0}</strong></span>
                <span>🎮 Matches: <strong className="text-blue-400">{profile?.totalMatches ?? 0}</strong></span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 text-slate-300 text-xs">
            <div className="p-2 bg-slate-700/50 rounded-xl">
              <Shield size={18} className="text-blue-400" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-slate-200">Firebase Cloud Profile</div>
              <div className="text-[11px] text-slate-400">Sign in to save wins & climb the leaderboard</div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 ml-auto">
          {user && (
            <button
              onClick={openProfile}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-bold transition-all active:scale-95"
            >
              <BarChart2 size={14} />
              Profile
            </button>
          )}
          <button
            onClick={openLeaderboard}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all active:scale-95"
          >
            <Trophy size={14} />
            Leaderboard
          </button>

          {user ? (
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-xs font-bold transition-all active:scale-95"
              title="Sign Out"
            >
              <LogOut size={14} />
              Logout
            </button>
          ) : (
            <button
              onClick={handleLogin}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              <LogIn size={14} />
              {isLoading ? 'Signing in...' : 'Google Sign In'}
            </button>
          )}
        </div>
      </div>


      {/* Profile & Detailed Statistics Modal */}
      {showProfile && user && profile && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative text-left max-h-[90vh] flex flex-col">
            <button
              onClick={() => setShowProfile(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X size={20} />
            </button>
            <div className="flex items-center gap-4 mb-6">
              {user.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-16 h-16 rounded-full border-2 border-purple-500 object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white text-2xl border-2 border-purple-500">
                  {profile.displayName[0].toUpperCase()}
                </div>
              )}
              <div>
                <h3 className="text-2xl font-black text-white">{profile.displayName}</h3>
                <p className="text-sm text-slate-400">Rating: <strong className="text-purple-400">{(profile.rating ?? profile.rankPoints ?? 0).toFixed(0)}</strong></p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-slate-800 rounded-xl p-3 border border-slate-700 text-center">
                <div className="text-xs text-slate-400 font-bold mb-1">Win Rate</div>
                <div className="text-lg font-black text-white">
                  {profile.totalMatches > 0 ? ((profile.totalWins / profile.totalMatches) * 100).toFixed(1) : 0}%
                </div>
              </div>
              <div className="bg-slate-800 rounded-xl p-3 border border-slate-700 text-center">
                <div className="text-xs text-slate-400 font-bold mb-1">K/D Ratio</div>
                <div className="text-lg font-black text-red-400">
                  {profile.totalDeaths ? (profile.totalKills / profile.totalDeaths).toFixed(2) : profile.totalKills.toFixed(2)}
                </div>
              </div>
              <div className="bg-slate-800 rounded-xl p-3 border border-slate-700 text-center">
                <div className="text-xs text-slate-400 font-bold mb-1">Favorite Class</div>
                <div className="text-lg font-black text-blue-400 capitalize">
                  {profile.favoriteClass || 'N/A'}
                </div>
              </div>
            </div>

            <h4 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Activity size={18} className="text-purple-400" /> Recent Rating History
            </h4>
            
            {isLoadingProfile ? (
              <div className="py-12 text-center text-slate-400 font-bold animate-pulse">Loading history...</div>
            ) : history.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">No ranked history found. Play a ranked match!</div>
            ) : (
              <div className="flex-1 min-h-[190px] py-1">
                <RatingHistoryChart history={history} />
              </div>
            )}
            
            <div className="mt-4 pt-4 border-t border-slate-800 flex justify-end">
               <div className="text-xs text-slate-500">Joined: {new Date(profile.createdAt).toLocaleDateString()}</div>
            </div>
          </div>
        </div>
      )}

      {/* Global Leaderboard Modal */}
      {showLeaderboard && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative text-left">
            <button
              onClick={() => setShowLeaderboard(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-yellow-500/20 text-yellow-400 rounded-xl border border-yellow-500/30">
                <Trophy size={22} />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">Global Leaderboard</h3>
                <p className="text-xs text-slate-400">Powered by Firebase Firestore</p>
              </div>
            </div>

            {isLoadingLb ? (
              <div className="py-12 text-center text-slate-400 font-bold animate-pulse">
                Loading Top Champions...
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">
                No leaderboard entries yet. Win a match to claim #1 rank!
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {leaderboard.map((entry, idx) => (
                  <div
                    key={entry.userId}
                    className={`flex items-center justify-between p-3 rounded-xl border ${
                      idx === 0
                        ? 'bg-yellow-500/10 border-yellow-500/40 text-yellow-300'
                        : idx === 1
                        ? 'bg-slate-300/10 border-slate-400/40 text-slate-200'
                        : idx === 2
                        ? 'bg-amber-700/10 border-amber-600/40 text-amber-300'
                        : 'bg-slate-800/60 border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-black text-sm w-6 text-center">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                      </span>
                      <span className="font-bold text-sm truncate max-w-[160px]">
                        {entry.displayName}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-semibold">
                      <span className="flex items-center gap-1 text-yellow-400">
                        <Award size={13} /> {entry.totalWins} Wins
                      </span>
                      <span className="text-red-400">
                        ⚔️ {entry.totalKills}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

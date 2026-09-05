// Frozen as-found source from the initial Piano snapshot, before P0/P1.
function initAudio(){
  ensureListener();
  if(!reverbInput && listener && !state.running){ try{ buildReverb(); }catch(e){} } else scheduleReverbBuild();
  if(audioInit){ if(rawCtx && rawCtx.state!=='running'){ try{ rawCtx.resume().catch(()=>{}); }catch(e){} } return; }   // retry the context resume: a pad-first start lacks the user gesture, and Firefox REJECTS that first resume outright — the next real click/keypress lands here and must issue a fresh one
  if(!window.Tone){ toneReady=false; loadToneOnce().catch(()=>{}); applyAudioState(); return; }
  audioInit=true;
  try{
    Tone.start();
    rawCtx = (Tone.getContext && Tone.getContext().rawContext) ? Tone.getContext().rawContext : null;
    const out=new Tone.Volume(-6).toDestination();
    synthHit=new Tone.Synth({oscillator:{type:'triangle'},envelope:{attack:0.001,decay:0.09,sustain:0,release:0.02}}).connect(out);
    synthLow=new Tone.Synth({oscillator:{type:'square'},envelope:{attack:0.001,decay:0.14,sustain:0,release:0.03}}).connect(new Tone.Volume(-10).toDestination());
    synthLvl=new Tone.Synth({oscillator:{type:'sawtooth'},envelope:{attack:0.002,decay:0.12,sustain:0,release:0.05}}).connect(out);
    noiseFire=new Tone.NoiseSynth({noise:{type:'white'},envelope:{attack:0.001,decay:0.05,sustain:0}}).connect(new Tone.Volume(-16).toDestination());
    try{ chordSynth=new Tone.PolySynth(Tone.Synth,{oscillator:{type:'triangle'},envelope:{attack:0.005,decay:0.3,sustain:0.05,release:0.5}}).connect(new Tone.Volume(-13).toDestination()); }catch(e){ chordSynth=null; }
    try{ arcWhoosh=new Tone.Synth({oscillator:{type:'triangle'},envelope:{attack:0.012,decay:0.12,sustain:0.35,release:0.14}}).connect(new Tone.Volume(-22).toDestination()); }catch(e){ arcWhoosh=null; }   // ARC flight whoosh (quieter bed under the new muzzle; pitch from theme scale)
    if(ML_DOOR_CROSS) try{ doorWhoosh=new Tone.Synth({oscillator:{type:'triangle'},envelope:{attack:0.005,decay:0.13,sustain:0.18,release:0.06}}).connect(new Tone.Volume(DOOR_WHOOSH_DB).toDestination()); }catch(e){ doorWhoosh=null; }   // ONE build-time doorway voice: the per-crossing call only sweeps this shared triangle; the flat switch builds no node
    try{ fireMuzzle=new Tone.NoiseSynth({noise:{type:'brown'},envelope:{attack:0.001,decay:0.04,sustain:0,release:0.02}}).connect(new Tone.Filter(1600,'lowpass').connect(new Tone.Volume(-13).toDestination())); }catch(e){ fireMuzzle=null; }   // soft muzzle thump (brown noise — not a harsh white crack)
    try{ firePluck=new Tone.Synth({oscillator:{type:'sine'},envelope:{attack:0.001,decay:0.07,sustain:0,release:0.03}}).connect(new Tone.Volume(-10).toDestination()); }catch(e){ firePluck=null; }   // in-key pluck so the launch sits with the song
    toneReady=true;
  }catch(e){ toneReady=false; audioInit=false; }
  applyAudioState();
  if(CFG.chorus.on){ chorusSaltRefresh(); chorusEnsure(); }   // THE STANDING CHORUS is built WITH the graph, never on demand: its first moment used to be a mercy downbeat, so a PolySynth, a filter and a Volume were being constructed inside the Transport callback that had just asked it to sing. Built here it is born muted and costs nothing but memory until a moment opens the gate, and the salt is warm before any pick. Raw boolean first — parcel off builds no node
}

function applyAudioState(){
  if(CHIP_FIELD && !(state.running && !templeActive && soundOn)) try{ humFieldStop(); }catch(e){}
  if(listener) listener.setMasterVolume((state.running && !templeActive && soundOn)?1:0);
  if(drumBus) drumBus.mute = !(state.running && !templeActive && soundOn);
  if(CHIP_PAD && !(state.running && !templeActive && soundOn)) padChipStop();   // native pitch automation outlives Transport callbacks, so a silent boundary must clear the optional mono channel too
  try{ if(window.Tone&&Tone.Destination) Tone.Destination.mute=!!(templeActive||!soundOn); }catch(e){}   // silence direct-routed combat notes already scheduled before Temple entry
}

function sfx(kind){
  if(!soundOn || !toneReady) return;
  try{
    const now=Tone.now();
    if(kind==='hit'){ synthHit.triggerAttackRelease(880*Math.pow(2,Math.min(state.streak,12)/24),0.06,now); }
    else if(kind==='whiff'){ noiseFire.triggerAttackRelease(0.04,now); }
    else if(kind==='offbeat'){ synthLow.triggerAttackRelease(220,0.08,now); }   // late hit → in-key (A3), plain (not a buzz)
    else if(kind==='expire'){ synthLow.triggerAttackRelease(110,0.14,now); }     // missed entirely → low in-key (A2) drop
    else if(kind==='levelUp'){ synthLvl.triggerAttackRelease(523,0.08,now); synthLvl.triggerAttackRelease(784,0.10,now+0.09); }
    else if(kind==='levelDown'){ synthLvl.triggerAttackRelease(392,0.08,now); synthLvl.triggerAttackRelease(262,0.12,now+0.09); }
  }catch(e){}
}

function playClankSfx(){   // one metal thud (no triple-layer stack)
  if(!soundOn || !toneReady) return;
  try{
    const now=Tone.now();
    if(shotCue) shotCue.triggerAttackRelease(72, '16n', now, 0.75);
    if(synthLow) synthLow.triggerAttackRelease(92, 0.09, now, 0.55);
  }catch(e){}
}

function playWhiffSfx(){   // soft air miss only
  if(!soundOn || !toneReady) return;
  try{ if(noiseFire) noiseFire.triggerAttackRelease(0.05, Tone.now(), 0.45); }catch(e){}
}

function onExpire(tg){
  if(GH_RECORD) ghostRecordTargetOutcome(tg,0);   // NIGHT GHOSTS: every real target arrival is counted before the existing quiet/penalty branches diverge
  if(tg.kind===2){ removeTarget(tg); return; }
  if(CFG.tank.fillOnly && tg.fill16>=0){ removeTarget(tg); return; }   // THE TANK IS A DRUM FILL, unfinished: the fill you did not play simply closes and departs at mercy end — NO penalty beyond departure (SPEC §5, v1.1 amendment). Modelled on the decoy branch above and deliberately as quiet: no streak reset, no pushEvent (so it never enters the adaptive accuracy window or the Quiet Tick ledger), no FADED, no whiff, no groove duck, no trauma. A figure is an OFFER; the generic expiry path below would charge you for declining it. Raw kill-switch first, so with fillOnly:false this line costs one read and every orb keeps today's expiry exactly
  removeTarget(tg); state.streak=0; pushEvent(false); showTiming(T('faded','FADED'),T('fadedSub','listen for the next'),'off');
  playWhiffSfx(); missGrooveDuck(false);
  if(!reduceMotion) addTrauma(CFG.hitTrauma*0.14);
}

function playFireLaunch(flightT){   // two-layer launch: soft muzzle + quieter in-key whoosh (sits with the theme, doesn't fight the bed)
  if(!soundOn || !toneReady) return;
  try{
    const now=Tone.now();
    const lo=(PENTA&&PENTA.length)?PENTA[0]:220;                 // theme scale root (or fallback A3)
    const hi=(PENTA&&PENTA.length)?PENTA[Math.min(4,PENTA.length-1)]:440;
    const sensei=true;   // SENSEI-only dojo (difficulty picker cut 2026-07-09)
    if(fireMuzzle) fireMuzzle.triggerAttackRelease(0.032, now, sensei?0.62:0.5);
    if(firePluck) firePluck.triggerAttackRelease(lo*2, '32n', now, sensei?0.78:0.65);   // octave up = clear “shot” without stealing the lead melody
    if(arcWhoosh){
      const ft=Math.max(0.18, Math.min(2.2, flightT||0.6));
      const a=lo*0.9, b=hi*1.05;
      arcWhoosh.triggerAttackRelease(a, ft, now, sensei?0.38:0.32);
      arcWhoosh.frequency.cancelScheduledValues(now);
      arcWhoosh.frequency.setValueAtTime(a, now);
      arcWhoosh.frequency.linearRampToValueAtTime(b, now+ft*0.85);
    }
  }catch(e){}
}

function chordHit(streak){                               // an open (fifth) chord a 1/4-beat after a hit, rising with the streak — no 3rd, so it never clashes major/minor with the A-minor bed
  if(!soundOn || !toneReady || !chordSynth) return;
  try{ const root=PENTA[Math.min(streak, PENTA.length-1)];
    chordSynth.triggerAttackRelease([root, root*1.5, root*2, root*3], '8n', Tone.now()+(60/state.bpm)*0.25, 0.45);
  }catch(e){}
}

function maybeArmFlickBonus(){   // called from gradeRhythmHit on a good kill; the call site already checked good && gradeIdx<=CFG.flickBonus.gradeMax && !bonusActive
  if(!CFG.flickBonus || !CFG.grooveGroove || reduceMotion) return;                 // groove-only, reduced-motion off (freeze is a motion effect)
  if(state.streak<CFG.flickBonus.streakGate) return;                               // must be on a hot streak
  if(state.t-_bonusLast<CFG.flickBonus.cooldown) return;                           // keep it a treat, not a strobe (mirrors clutch)
  try{ updatePocketMisses(); }catch(e){}                                           // close the normal-input frontier immediately before bonus takes ownership
  bonusActive=true; _bonusResolving=false; _bonusJustArmed=true; bonusLocks.length=0;   // _bonusJustArmed → updateFlickBonus clears in-flight projectiles NEXT (safely, after updateProjectiles' loop this frame)
  _bonusGrace=CFG.flickBonus.graceMisses;
  _bonusEntryBeat=currentRawBeat(); bonusEndsBeat=_bonusEntryBeat+CFG.flickBonus.baseBeats;
  if(soundOn && toneReady){ try{ const t=beatSnap(); if(lead){ lead.triggerAttackRelease(PENTA[4],'8n',t,0.7); lead.triggerAttackRelease(PENTA[6],'8n',t+0.06,0.6); } if(chordSynth) chordSynth.triggerAttackRelease([PENTA[0],PENTA[2],PENTA[4]],'4n',t,0.4); }catch(e){} }   // a rising two-note "mode on" flourish + an open chord
}

function roadTideAt(n){
  // THE SWELL AT BEAT n — onGrid's own tide expression, replayed on that beat's EIGHTH index. onGrid runs on Tone's '8n'
  // repeat from a Transport that teardownTransport resets to 0 alongside grid8, so the eighth whose audio sounds at heard
  // beat b is exactly g = 2b: this is the same clock, read at a different time, not a second one. Returns {m,i,cb}:
  //   m = 0 not mercy · 1 the mercy bar's FIRST beat (it keeps its "1" line) · 2 a mercy continuation (its line is swallowed,
  //       which is what makes the bar read as ONE wide band) — i = tideI, the luminance rider · cb = this same cycle's bar.
  // Kill-switch first: with tide.on:false the swell rests neutral exactly as onGrid's own else-branch leaves it.
  if(!(CFG.tide && CFG.tide.on)) return _roadTide0;
  const TD=CFG.tide, rise=Math.max(1,TD.riseBars|0), peak=Math.max(0,TD.peakBars|0), cyc=rise+peak+Math.max(0,TD.mercyBars|0);
  const g=2*n, bar=Math.floor(g/8), cb=((bar%cyc)+cyc)%cyc, f=(((g%8)+8)%8)/8;
  const mercy=cb>=rise+peak;
  _roadTideR.m = mercy ? ((cb===rise+peak && (((g%8)+8)%8)===0) ? 1 : 2) : 0;
  _roadTideR.i = mercy ? 0 : (cb<rise ? (cb+f)/rise : 1);
  _roadTideR.cb = cb;
  return _roadTideR;
}

function doorCross(bar){
  // THE DOORWAY IS ONE EVENT, not a second clock: roadSync calls here only after its absolute bar latch advances and has
  // already put this frame's one road read into the uniform clock. The visual stamp is a sink. Audio reconstructs the tide's
  // cycle from this absolute bar without moving grid8, Transport, spawning, grading, or the private course/palette streams.
  if(!ML_DOOR_CROSS || !roadLive() || trainMode || templeActive) return;
  _wallCross.value=(reduceMotion?roadMat.uniforms.uPulse:roadMat.uniforms.uNow).value;
  if(!soundOn || !toneReady || !doorWhoosh || !(CFG.tide && CFG.tide.on)) return;
  const TD=CFG.tide, rise=Math.max(1,TD.riseBars|0), peak=Math.max(0,TD.peakBars|0), mercyN=Math.max(0,TD.mercyBars|0), cyc=rise+peak+mercyN;
  if(!mercyN || !cyc) return;
  const cb=((bar%cyc)+cyc)%cyc, mercy=roadTideAt(bar*ML_ARCH_EVERY).m===1, barsToMercy=((rise+peak-cb)%cyc+cyc)%cyc;
  if(!mercy && barsToMercy>=3) return;
  try{
    const at=beatSnap(), velocity=barsToMercy===2?Math.pow(10,-6/20):1;
    doorWhoosh.triggerAttackRelease(DOOR_WHOOSH_HZ[0],DOOR_WHOOSH_SEC,at,velocity);
    doorWhoosh.frequency.cancelScheduledValues(at); doorWhoosh.frequency.setValueAtTime(DOOR_WHOOSH_HZ[0],at); doorWhoosh.frequency.linearRampToValueAtTime(DOOR_WHOOSH_HZ[1],at+DOOR_WHOOSH_SEC);
    const tonic=mercy&&pad&&CHORD_TRIAD&&CHORD_TRIAD[0]&&CHORD_TRIAD[0][0];
    if(tonic) padChord(tonic,'16n',at,Math.max(0,+TD.padPeakVel||0));
  }catch(e){}
}

function chorusEnsure(){
  if(chorusVoice || !toneReady) return chorusVoice;
  try{
    chorusVol=new Tone.Volume(CHORUS_VOL_DB).toDestination(); chorusVol.mute=true;   // BORN MUTED: the parcel's silence is the node's default state
    chorusVoice=new Tone.PolySynth(Tone.Synth,{oscillator:{type:'triangle'},envelope:{attack:0.9,decay:0.4,sustain:0.9,release:CHORUS_REL_SEC}}).connect(new Tone.Filter(1500,'lowpass').connect(chorusVol));   // slow attack + near-full sustain = a voice that swells rather than plays; the lowpass keeps the triangle from glinting over the arrangement
    chorusVoice.maxPolyphony=chorusCap();   // EXACTLY maxStems — the ceiling the spec states, now enforced by the synth itself. The old ×2 "tail headroom" existed so a handover could put a fresh octet on top of eight still-releasing stems, which is precisely the sixteen-voice pile this parcel promised could never happen. The cap is the promise; chorusCut is what makes it survivable (Tone does not steal — it DROPS)
    chorusWarm();                           // and the pool itself, here on the main thread, for the same reason the node is
  }catch(e){ chorusVoice=null; chorusVol=null; }
  return chorusVoice;
}

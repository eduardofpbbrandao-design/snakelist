import { useState, useEffect, useMemo } from "react";
import { Search, X, MapPin, Check, Compass, BookOpen } from "lucide-react";

// type: Python | Boa | Colubrid | Watersnake | Cobra | Viper | Pit Viper | Elapid | Sea Snake | Other
// continent: North America | South America | Europe | Africa | Asia | Australia
const SPECIES = [
  { id: "ball-python", name: "Ball Python", sci: "Python regius", family: "Pythonidae", region: "West & Central Africa", type: "Python", continent: "Africa", venomous: false, size: "medium" },
  { id: "burmese-python", name: "Burmese Python", sci: "Python bivittatus", family: "Pythonidae", region: "Southeast Asia", type: "Python", continent: "Asia", venomous: false, size: "giant" },
  { id: "reticulated-python", name: "Reticulated Python", sci: "Malayopython reticulatus", family: "Pythonidae", region: "Southeast Asia", type: "Python", continent: "Asia", venomous: false, size: "giant" },
  { id: "green-anaconda", name: "Green Anaconda", sci: "Eunectes murinus", family: "Boidae", region: "South America", type: "Boa", continent: "South America", venomous: false, size: "giant" },
  { id: "yellow-anaconda", name: "Yellow Anaconda", sci: "Eunectes notaeus", family: "Boidae", region: "South America", type: "Boa", continent: "South America", venomous: false, size: "large" },
  { id: "boa-constrictor", name: "Boa Constrictor", sci: "Boa constrictor", family: "Boidae", region: "Central & South America", type: "Boa", continent: "South America", venomous: false, size: "large" },
  { id: "emerald-tree-boa", name: "Emerald Tree Boa", sci: "Corallus caninus", family: "Boidae", region: "South America", type: "Boa", continent: "South America", venomous: false, size: "medium" },
  { id: "rainbow-boa", name: "Rainbow Boa", sci: "Epicrates cenchria", family: "Boidae", region: "South America", type: "Boa", continent: "South America", venomous: false, size: "medium" },
  { id: "rosy-boa", name: "Rosy Boa", sci: "Lichanura trivirgata", family: "Boidae", region: "Southwest North America", type: "Boa", continent: "North America", venomous: false, size: "small" },
  { id: "kenyan-sand-boa", name: "Kenyan Sand Boa", sci: "Eryx colubrinus", family: "Boidae", region: "East Africa", type: "Boa", continent: "Africa", venomous: false, size: "small" },
  { id: "green-tree-python", name: "Green Tree Python", sci: "Morelia viridis", family: "Pythonidae", region: "New Guinea & Australia", type: "Python", continent: "Australia", venomous: false, size: "medium" },
  { id: "carpet-python", name: "Carpet Python", sci: "Morelia spilota", family: "Pythonidae", region: "Australia", type: "Python", continent: "Australia", venomous: false, size: "large" },
  { id: "woma-python", name: "Woma Python", sci: "Aspidites ramsayi", family: "Pythonidae", region: "Australia", type: "Python", continent: "Australia", venomous: false, size: "medium" },
  { id: "blood-python", name: "Blood Python", sci: "Python brongersmai", family: "Pythonidae", region: "Southeast Asia", type: "Python", continent: "Asia", venomous: false, size: "medium" },
  { id: "sunbeam-snake", name: "Sunbeam Snake", sci: "Xenopeltis unicolor", family: "Xenopeltidae", region: "Southeast Asia", type: "Other", continent: "Asia", venomous: false, size: "small" },
  { id: "corn-snake", name: "Corn Snake", sci: "Pantherophis guttatus", family: "Colubridae", region: "North America", type: "Colubrid", continent: "North America", venomous: false, size: "medium" },
  { id: "eastern-ratsnake", name: "Eastern Ratsnake", sci: "Pantherophis alleghaniensis", family: "Colubridae", region: "North America", type: "Colubrid", continent: "North America", venomous: false, size: "large" },
  { id: "kingsnake", name: "Common Kingsnake", sci: "Lampropeltis getula", family: "Colubridae", region: "North America", type: "Colubrid", continent: "North America", venomous: false, size: "medium" },
  { id: "scarlet-kingsnake", name: "Scarlet Kingsnake", sci: "Lampropeltis elapsoides", family: "Colubridae", region: "North America", type: "Colubrid", continent: "North America", venomous: false, size: "small" },
  { id: "milk-snake", name: "Milk Snake", sci: "Lampropeltis triangulum", family: "Colubridae", region: "The Americas", type: "Colubrid", continent: "North America", venomous: false, size: "medium" },
  { id: "black-racer", name: "Black Racer", sci: "Coluber constrictor", family: "Colubridae", region: "North America", type: "Colubrid", continent: "North America", venomous: false, size: "medium" },
  { id: "coachwhip", name: "Coachwhip", sci: "Masticophis flagellum", family: "Colubridae", region: "North America", type: "Colubrid", continent: "North America", venomous: false, size: "large" },
  { id: "eastern-hognose", name: "Eastern Hognose Snake", sci: "Heterodon platirhinos", family: "Colubridae", region: "North America", type: "Colubrid", continent: "North America", venomous: false, size: "small" },
  { id: "western-hognose", name: "Western Hognose Snake", sci: "Heterodon nasicus", family: "Colubridae", region: "North America", type: "Colubrid", continent: "North America", venomous: false, size: "small" },
  { id: "gopher-snake", name: "Gopher Snake", sci: "Pituophis catenifer", family: "Colubridae", region: "North America", type: "Colubrid", continent: "North America", venomous: false, size: "large" },
  { id: "bullsnake", name: "Bullsnake", sci: "Pituophis catenifer sayi", family: "Colubridae", region: "North America", type: "Colubrid", continent: "North America", venomous: false, size: "large" },
  { id: "pine-snake", name: "Pine Snake", sci: "Pituophis melanoleucus", family: "Colubridae", region: "North America", type: "Colubrid", continent: "North America", venomous: false, size: "large" },
  { id: "ringneck-snake", name: "Ringneck Snake", sci: "Diadophis punctatus", family: "Colubridae", region: "North America", type: "Colubrid", continent: "North America", venomous: false, size: "small" },
  { id: "rough-green-snake", name: "Rough Green Snake", sci: "Opheodrys aestivus", family: "Colubridae", region: "North America", type: "Colubrid", continent: "North America", venomous: false, size: "small" },
  { id: "eastern-indigo", name: "Eastern Indigo Snake", sci: "Drymarchon couperi", family: "Colubridae", region: "North America", type: "Colubrid", continent: "North America", venomous: false, size: "large" },
  { id: "glossy-snake", name: "Glossy Snake", sci: "Arizona elegans", family: "Colubridae", region: "North America", type: "Colubrid", continent: "North America", venomous: false, size: "medium" },
  { id: "aesculapian-snake", name: "Aesculapian Snake", sci: "Zamenis longissimus", family: "Colubridae", region: "Europe", type: "Colubrid", continent: "Europe", venomous: false, size: "large" },
  { id: "smooth-snake", name: "Smooth Snake", sci: "Coronella austriaca", family: "Colubridae", region: "Europe", type: "Colubrid", continent: "Europe", venomous: false, size: "small" },
  { id: "aodaisho", name: "Japanese Ratsnake", sci: "Elaphe climacophora", family: "Colubridae", region: "Japan", type: "Colubrid", continent: "Asia", venomous: false, size: "medium" },
  { id: "mangrove-snake", name: "Mangrove Snake", sci: "Boiga dendrophila", family: "Colubridae", region: "Southeast Asia", type: "Colubrid", continent: "Asia", venomous: true, size: "medium" },
  { id: "boomslang", name: "Boomslang", sci: "Dispholidus typus", family: "Colubridae", region: "Sub-Saharan Africa", type: "Colubrid", continent: "Africa", venomous: true, size: "medium" },
  { id: "vine-snake", name: "Mexican Vine Snake", sci: "Oxybelis aeneus", family: "Colubridae", region: "Central America", type: "Colubrid", continent: "North America", venomous: true, size: "small" },
  { id: "paradise-flying-snake", name: "Paradise Flying Snake", sci: "Chrysopelea paradisi", family: "Colubridae", region: "Southeast Asia", type: "Colubrid", continent: "Asia", venomous: true, size: "small" },
  { id: "long-nosed-vine-snake", name: "Long-Nosed Vine Snake", sci: "Ahaetulla nasuta", family: "Colubridae", region: "South Asia", type: "Colubrid", continent: "Asia", venomous: true, size: "small" },
  { id: "montpellier-snake", name: "Montpellier Snake", sci: "Malpolon monspessulanus", family: "Lamprophiidae", region: "Southern Europe", type: "Colubrid", continent: "Europe", venomous: true, size: "large" },
  { id: "garter-snake", name: "Common Garter Snake", sci: "Thamnophis sirtalis", family: "Natricidae", region: "North America", type: "Colubrid", continent: "North America", venomous: false, size: "small" },
  { id: "northern-water-snake", name: "Northern Water Snake", sci: "Nerodia sipedon", family: "Natricidae", region: "North America", type: "Watersnake", continent: "North America", venomous: false, size: "medium" },
  { id: "diamondback-water-snake", name: "Diamondback Water Snake", sci: "Nerodia rhombifer", family: "Natricidae", region: "North America", type: "Watersnake", continent: "North America", venomous: false, size: "medium" },
  { id: "dekays-brownsnake", name: "De Kay's Brown Snake", sci: "Storeria dekayi", family: "Natricidae", region: "North America", type: "Colubrid", continent: "North America", venomous: false, size: "small" },
  { id: "grass-snake", name: "Grass Snake", sci: "Natrix natrix", family: "Natricidae", region: "Europe", type: "Watersnake", continent: "Europe", venomous: false, size: "medium" },
  { id: "dice-snake", name: "Dice Snake", sci: "Natrix tessellata", family: "Natricidae", region: "Europe & Asia", type: "Watersnake", continent: "Europe", venomous: false, size: "small" },
  { id: "tiger-keelback", name: "Tiger Keelback", sci: "Rhabdophis tigrinus", family: "Natricidae", region: "East Asia", type: "Watersnake", continent: "Asia", venomous: true, size: "small" },
  { id: "tentacled-snake", name: "Tentacled Snake", sci: "Erpeton tentaculatum", family: "Homalopsidae", region: "Southeast Asia", type: "Watersnake", continent: "Asia", venomous: true, size: "small" },
  { id: "brahminy-blind-snake", name: "Brahminy Blind Snake", sci: "Indotyphlops braminus", family: "Typhlopidae", region: "Pantropical", type: "Other", continent: "Asia", venomous: false, size: "small" },
  { id: "timber-rattlesnake", name: "Timber Rattlesnake", sci: "Crotalus horridus", family: "Viperidae", region: "North America", type: "Pit Viper", continent: "North America", venomous: true, size: "large" },
  { id: "eastern-diamondback", name: "Eastern Diamondback Rattlesnake", sci: "Crotalus adamanteus", family: "Viperidae", region: "North America", type: "Pit Viper", continent: "North America", venomous: true, size: "large" },
  { id: "western-diamondback", name: "Western Diamondback Rattlesnake", sci: "Crotalus atrox", family: "Viperidae", region: "North America", type: "Pit Viper", continent: "North America", venomous: true, size: "large" },
  { id: "mojave-rattlesnake", name: "Mojave Rattlesnake", sci: "Crotalus scutulatus", family: "Viperidae", region: "North America", type: "Pit Viper", continent: "North America", venomous: true, size: "medium" },
  { id: "prairie-rattlesnake", name: "Prairie Rattlesnake", sci: "Crotalus viridis", family: "Viperidae", region: "North America", type: "Pit Viper", continent: "North America", venomous: true, size: "medium" },
  { id: "speckled-rattlesnake", name: "Speckled Rattlesnake", sci: "Crotalus mitchellii", family: "Viperidae", region: "North America", type: "Pit Viper", continent: "North America", venomous: true, size: "medium" },
  { id: "sidewinder", name: "Sidewinder", sci: "Crotalus cerastes", family: "Viperidae", region: "North America", type: "Pit Viper", continent: "North America", venomous: true, size: "small" },
  { id: "massasauga", name: "Massasauga", sci: "Sistrurus catenatus", family: "Viperidae", region: "North America", type: "Pit Viper", continent: "North America", venomous: true, size: "small" },
  { id: "copperhead", name: "Copperhead", sci: "Agkistrodon contortrix", family: "Viperidae", region: "North America", type: "Pit Viper", continent: "North America", venomous: true, size: "medium" },
  { id: "cottonmouth", name: "Cottonmouth", sci: "Agkistrodon piscivorus", family: "Viperidae", region: "North America", type: "Pit Viper", continent: "North America", venomous: true, size: "medium" },
  { id: "european-adder", name: "European Adder", sci: "Vipera berus", family: "Viperidae", region: "Europe", type: "Viper", continent: "Europe", venomous: true, size: "small" },
  { id: "gaboon-viper", name: "Gaboon Viper", sci: "Bitis gabonica", family: "Viperidae", region: "Sub-Saharan Africa", type: "Viper", continent: "Africa", venomous: true, size: "large" },
  { id: "puff-adder", name: "Puff Adder", sci: "Bitis arietans", family: "Viperidae", region: "Africa & Arabia", type: "Viper", continent: "Africa", venomous: true, size: "medium" },
  { id: "rhinoceros-viper", name: "Rhinoceros Viper", sci: "Bitis nasicornis", family: "Viperidae", region: "West & Central Africa", type: "Viper", continent: "Africa", venomous: true, size: "medium" },
  { id: "saw-scaled-viper", name: "Saw-Scaled Viper", sci: "Echis carinatus", family: "Viperidae", region: "Asia & Africa", type: "Viper", continent: "Asia", venomous: true, size: "small" },
  { id: "russells-viper", name: "Russell's Viper", sci: "Daboia russelii", family: "Viperidae", region: "South Asia", type: "Viper", continent: "Asia", venomous: true, size: "medium" },
  { id: "fer-de-lance", name: "Fer-de-Lance", sci: "Bothrops asper", family: "Viperidae", region: "Central & South America", type: "Pit Viper", continent: "South America", venomous: true, size: "large" },
  { id: "bushmaster", name: "Bushmaster", sci: "Lachesis muta", family: "Viperidae", region: "South America", type: "Pit Viper", continent: "South America", venomous: true, size: "large" },
  { id: "eyelash-viper", name: "Eyelash Viper", sci: "Bothriechis schlegelii", family: "Viperidae", region: "Central & South America", type: "Pit Viper", continent: "South America", venomous: true, size: "small" },
  { id: "malayan-pit-viper", name: "Malayan Pit Viper", sci: "Calloselasma rhodostoma", family: "Viperidae", region: "Southeast Asia", type: "Pit Viper", continent: "Asia", venomous: true, size: "medium" },
  { id: "waglers-pit-viper", name: "Wagler's Pit Viper", sci: "Tropidolaemus wagleri", family: "Viperidae", region: "Southeast Asia", type: "Pit Viper", continent: "Asia", venomous: true, size: "small" },
  { id: "king-cobra", name: "King Cobra", sci: "Ophiophagus hannah", family: "Elapidae", region: "South & Southeast Asia", type: "Cobra", continent: "Asia", venomous: true, size: "giant" },
  { id: "indian-cobra", name: "Indian Cobra", sci: "Naja naja", family: "Elapidae", region: "South Asia", type: "Cobra", continent: "Asia", venomous: true, size: "medium" },
  { id: "egyptian-cobra", name: "Egyptian Cobra", sci: "Naja haje", family: "Elapidae", region: "Africa", type: "Cobra", continent: "Africa", venomous: true, size: "large" },
  { id: "cape-cobra", name: "Cape Cobra", sci: "Naja nivea", family: "Elapidae", region: "Southern Africa", type: "Cobra", continent: "Africa", venomous: true, size: "medium" },
  { id: "banded-water-cobra", name: "Banded Water Cobra", sci: "Naja annulata", family: "Elapidae", region: "Central Africa", type: "Cobra", continent: "Africa", venomous: true, size: "medium" },
  { id: "rinkhals", name: "Rinkhals", sci: "Hemachatus haemachatus", family: "Elapidae", region: "Southern Africa", type: "Cobra", continent: "Africa", venomous: true, size: "medium" },
  { id: "black-mamba", name: "Black Mamba", sci: "Dendroaspis polylepis", family: "Elapidae", region: "Sub-Saharan Africa", type: "Elapid", continent: "Africa", venomous: true, size: "large" },
  { id: "green-mamba", name: "Eastern Green Mamba", sci: "Dendroaspis angusticeps", family: "Elapidae", region: "East Africa", type: "Elapid", continent: "Africa", venomous: true, size: "medium" },
  { id: "inland-taipan", name: "Inland Taipan", sci: "Oxyuranus microlepidotus", family: "Elapidae", region: "Australia", type: "Elapid", continent: "Australia", venomous: true, size: "medium" },
  { id: "coastal-taipan", name: "Coastal Taipan", sci: "Oxyuranus scutellatus", family: "Elapidae", region: "Australia", type: "Elapid", continent: "Australia", venomous: true, size: "large" },
  { id: "eastern-brown-snake", name: "Eastern Brown Snake", sci: "Pseudonaja textilis", family: "Elapidae", region: "Australia", type: "Elapid", continent: "Australia", venomous: true, size: "medium" },
  { id: "tiger-snake", name: "Tiger Snake", sci: "Notechis scutatus", family: "Elapidae", region: "Australia", type: "Elapid", continent: "Australia", venomous: true, size: "medium" },
  { id: "death-adder", name: "Common Death Adder", sci: "Acanthophis antarcticus", family: "Elapidae", region: "Australia", type: "Elapid", continent: "Australia", venomous: true, size: "small" },
  { id: "eastern-coral-snake", name: "Eastern Coral Snake", sci: "Micrurus fulvius", family: "Elapidae", region: "North America", type: "Elapid", continent: "North America", venomous: true, size: "small" },
  { id: "yellow-bellied-sea-snake", name: "Yellow-Bellied Sea Snake", sci: "Hydrophis platurus", family: "Elapidae", region: "Pacific & Indian Oceans", type: "Sea Snake", continent: "Asia", venomous: true, size: "small" },
];

const TOTAL = SPECIES.length;
const STORAGE_KEY = "snakelist-sightings-v2";
const TYPES = [...new Set(SPECIES.map((s) => s.type))].sort();
const CONTINENTS = [...new Set(SPECIES.map((s) => s.continent))].sort();
const SIZE_LABEL = { small: "Small", medium: "Medium", large: "Large", giant: "Giant" };

function ScaleTrail({ checkedCount }) {
  const w = 640, h = 72, n = 28;
  const filled = Math.round((checkedCount / TOTAL) * n);
  const pts = Array.from({ length: n }, (_, i) => ({
    x: 14 + (i * (w - 28)) / (n - 1),
    y: h / 2 + Math.sin(i / 2.1) * 22,
    on: i < filled,
  }));
  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const headIdx = Math.max(0, filled - 1);
  const head = pts[headIdx] || pts[0];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="trail-svg" role="img" aria-label={`${checkedCount} of ${TOTAL} species seen`}>
      <path d={pathD} fill="none" stroke="var(--border)" strokeWidth="1.5" strokeDasharray="1 7" strokeLinecap="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === headIdx && filled > 0 ? 7 : 4.5} className={p.on ? "scale-on" : "scale-off"} style={{ transitionDelay: `${i * 12}ms` }} />
      ))}
      {filled > 0 && (
        <g transform={`translate(${head.x} ${head.y})`}>
          <ellipse rx="9" ry="6.5" fill="var(--gold)" />
          <circle cx="3" cy="-1.6" r="1" fill="var(--bg)" />
        </g>
      )}
    </svg>
  );
}

function Intro({ onDone }) {
  const [stage, setStage] = useState("enter");
  useEffect(() => {
    const t1 = setTimeout(() => setStage("wipe"), 1500);
    const t2 = setTimeout(() => onDone(), 2450);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);
  return (
    <div className={`intro ${stage === "wipe" ? "intro-wipe" : ""}`} onClick={onDone} role="button" aria-label="Skip intro">
      <div className="blob blob-a" />
      <div className="blob blob-b" />
      <div className="blob blob-c" />
      <div className="intro-content">
        <div className="tick-icon">
          <svg viewBox="0 0 64 64" width="64" height="64">
            <rect x="2" y="2" width="60" height="60" rx="16" fill="var(--gold)" />
            <path className="tick-path" d="M17 33 L27 43 L47 21" fill="none" stroke="#101c16" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="intro-title">Snake<em>List</em></div>
        <div className="intro-hint">tap to skip</div>
      </div>
    </div>
  );
}

export default function SnakeList() {
  const [introDone, setIntroDone] = useState(false);
  const [checked, setChecked] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("guide");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [continentFilters, setContinentFilters] = useState([]);
  const [exoticOnly, setExoticOnly] = useState(false);
  const [venomousOnly, setVenomousOnly] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, false);
        if (res && res.value) setChecked(JSON.parse(res.value));
      } catch (e) {
        // nothing saved yet
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const toggleSeen = async (id) => {
    setChecked((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = new Date().toISOString();
      window.storage.set(STORAGE_KEY, JSON.stringify(next), false).catch(() => {});
      return next;
    });
  };

  const toggleContinent = (c) => {
    setContinentFilters((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const checkedCount = useMemo(() => Object.keys(checked).length, [checked]);

  const guideResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SPECIES.filter((s) => {
      if (typeFilter !== "All" && s.type !== typeFilter) return false;
      if (continentFilters.length > 0 && !continentFilters.includes(s.continent)) return false;
      if (exoticOnly && s.continent === "North America") return false;
      if (venomousOnly && !s.venomous) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.sci.toLowerCase().includes(q) ||
        s.region.toLowerCase().includes(q) ||
        s.family.toLowerCase().includes(q) ||
        s.continent.toLowerCase().includes(q)
      );
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [query, typeFilter, continentFilters, exoticOnly, venomousOnly]);

  const sightings = useMemo(() => {
    return SPECIES.filter((s) => checked[s.id])
      .sort((a, b) => new Date(checked[b.id]) - new Date(checked[a.id]));
  }, [checked]);

  const dateFmt = (iso) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  const activeList = tab === "guide" ? guideResults : sightings;

  return (
    <div className="sl-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,500&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

        .sl-root {
          --bg: #f2f1e6;
          --surface: #ffffff;
          --surface-hover: #eceadb;
          --border: #dad8c5;
          --text: #24321f;
          --text-muted: #667261;
          --gold: #3f7d43;
          --gold-soft: #8fbf8f;
          --moss: #4c7a4f;
          --rust: #a24b34;
          --rust-soft: #f3ded4;
          --on-accent: #fbf9f0;
          font-family: 'Inter', sans-serif;
          background: var(--bg);
          color: var(--text);
          min-height: 100%;
          position: relative;
          overflow: hidden;
          box-sizing: border-box;
        }
        .sl-root * { box-sizing: border-box; }
        .sl-body { padding: 28px 20px 60px; }

        /* ---- Intro ---- */
        .intro {
          position: absolute; inset: 0; z-index: 50;
          display: flex; align-items: center; justify-content: center;
          background: var(--bg); cursor: pointer; overflow: hidden;
          clip-path: circle(150% at 50% 50%);
        }
        .intro-wipe { clip-path: circle(0% at 50% 50%); transition: clip-path 0.9s cubic-bezier(.76,0,.24,1); }
        .blob { position: absolute; border-radius: 50%; filter: blur(70px); opacity: 0.55; animation: drift 7s ease-in-out infinite; }
        .blob-a { width: 340px; height: 340px; background: #3f6b4a; top: -60px; left: -60px; animation-delay: 0s; }
        .blob-b { width: 280px; height: 280px; background: #244033; bottom: -60px; right: -40px; animation-delay: 1.5s; }
        .blob-c { width: 220px; height: 220px; background: #6b8f57; top: 40%; left: 60%; animation-delay: 3s; }
        @keyframes drift {
          0%, 100% { transform: translate(0,0) scale(1); }
          50% { transform: translate(18px,-14px) scale(1.08); }
        }
        .intro-content { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 14px; }
        .tick-icon { animation: pop-in 0.5s cubic-bezier(.2,1.4,.4,1) both; filter: drop-shadow(0 8px 24px rgba(63,125,67,0.35)); }
        .tick-path { stroke-dasharray: 40; stroke-dashoffset: 40; animation: draw 0.5s 0.35s ease forwards; }
        @keyframes draw { to { stroke-dashoffset: 0; } }
        @keyframes pop-in { from { transform: scale(0.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .intro-title { font-family: 'Fraunces', serif; font-weight: 700; font-size: 30px; opacity: 0; animation: fade-up 0.6s 0.55s ease forwards; }
        .intro-title em { font-style: italic; font-weight: 500; color: var(--gold); }
        .intro-hint { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-muted); opacity: 0; animation: fade-up 0.6s 1s ease forwards; }
        @keyframes fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

        .sl-header { max-width: 900px; margin: 0 auto 22px; }
        .eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--moss); margin: 0 0 6px; }
        .sl-title { font-family: 'Fraunces', serif; font-weight: 700; font-size: clamp(32px, 5vw, 48px); letter-spacing: -0.01em; margin: 0; line-height: 1; }
        .sl-title em { font-style: italic; font-weight: 500; color: var(--gold); }
        .sl-sub { color: var(--text-muted); font-size: 14.5px; margin: 10px 0 0; max-width: 46ch; }

        .trail-wrap { max-width: 900px; margin: 22px auto 8px; display: flex; align-items: center; gap: 18px; }
        .trail-svg { width: 100%; height: 60px; flex: 1; overflow: visible; }
        .scale-off { fill: var(--surface); stroke: var(--border); stroke-width: 1.4; transition: fill 0.4s ease; }
        .scale-on { fill: var(--gold); stroke: var(--gold-soft); stroke-width: 1.4; transition: fill 0.4s ease, r 0.3s ease; }
        .trail-count { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--text-muted); white-space: nowrap; text-align: right; }
        .trail-count b { color: var(--gold); font-size: 20px; font-weight: 500; }

        .tabs { max-width: 900px; margin: 20px auto 18px; display: flex; gap: 6px; border-bottom: 1px solid var(--border); }
        .tab-btn { display: flex; align-items: center; gap: 7px; background: none; border: none; color: var(--text-muted); font-family: 'Inter', sans-serif; font-size: 14px; padding: 10px 4px; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; }
        .tab-btn.active { color: var(--gold); border-bottom-color: var(--gold); }
        .tab-btn + .tab-btn { margin-left: 14px; }

        .controls { max-width: 900px; margin: 0 auto 14px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
        .search-box { flex: 1 1 240px; display: flex; align-items: center; gap: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; }
        .search-box input { flex: 1; background: transparent; border: none; outline: none; color: var(--text); font-family: 'Inter', sans-serif; font-size: 14px; }
        .search-box input::placeholder { color: var(--text-muted); }
        .icon-muted { color: var(--text-muted); flex-shrink: 0; }
        .clear-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; display: flex; padding: 2px; }
        .clear-btn:hover { color: var(--text); }

        .filter-group { max-width: 900px; margin: 0 auto 10px; }
        .filter-label { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-muted); margin: 0 0 7px; }
        .chip-row { display: flex; flex-wrap: wrap; gap: 7px; }
        .chip { font-family: 'Inter', sans-serif; font-size: 12.5px; padding: 6px 12px; border-radius: 999px; border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); cursor: pointer; user-select: none; transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease; }
        .chip:hover { border-color: var(--gold-soft); }
        .chip.active { background: var(--gold); color: var(--on-accent); border-color: var(--gold); font-weight: 500; }
        .chip.active.venom { background: var(--rust); border-color: var(--rust); color: #fff; }

        .result-count { max-width: 900px; margin: 4px auto 12px; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--text-muted); }

        .grid { max-width: 900px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }

        .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
        .card.done { border-color: var(--gold-soft); background: linear-gradient(180deg, rgba(63,125,67,0.08), transparent 60%), var(--surface); }
        .card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
        .card-name { font-family: 'Fraunces', serif; font-weight: 600; font-size: 17px; line-height: 1.25; }
        .card.done .card-name { color: var(--gold); }
        .card-sci { font-family: 'JetBrains Mono', monospace; font-style: italic; font-size: 11.5px; color: var(--text-muted); margin-top: 2px; }

        .card-tags { display: flex; flex-wrap: wrap; gap: 6px; }
        .tag { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; letter-spacing: 0.02em; padding: 3px 7px; border-radius: 999px; border: 1px solid var(--border); color: var(--text-muted); display: flex; align-items: center; gap: 4px; }
        .tag.venom { color: var(--rust); border-color: var(--rust-soft); }

        .card-bottom { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 2px; }
        .seen-date { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--text-muted); }
        .seen-btn { display: flex; align-items: center; gap: 6px; font-family: 'Inter', sans-serif; font-size: 12.5px; font-weight: 500; padding: 7px 12px; border-radius: 8px; border: 1px solid var(--border); background: transparent; color: var(--text); cursor: pointer; transition: all 0.15s ease; margin-left: auto; }
        .seen-btn:hover { border-color: var(--gold-soft); }
        .seen-btn.done { background: var(--gold); border-color: var(--gold); color: var(--on-accent); }

        .empty-state { max-width: 900px; margin: 40px auto; text-align: center; color: var(--text-muted); font-family: 'Fraunces', serif; font-style: italic; font-size: 16px; }

        @media (max-width: 480px) {
          .grid { grid-template-columns: 1fr; }
          .trail-wrap { flex-direction: column; align-items: stretch; gap: 6px; }
          .trail-count { text-align: left; }
        }
      `}</style>

      {!introDone && <Intro onDone={() => setIntroDone(true)} />}

      <div className="sl-body">
        <header className="sl-header">
          <p className="eyebrow">Field checklist &middot; est. herpetology</p>
          <h1 className="sl-title">Snake<em>List</em></h1>
          <p className="sl-sub">Your life list of serpents. Search the field guide, mark what you've seen, watch the trail grow.</p>
        </header>

        <div className="trail-wrap">
          <ScaleTrail checkedCount={checkedCount} />
          <div className="trail-count"><b>{checkedCount}</b> / {TOTAL}<br />seen</div>
        </div>

        <div className="tabs">
          <button className={`tab-btn ${tab === "guide" ? "active" : ""}`} onClick={() => setTab("guide")}>
            <BookOpen size={15} /> Field Guide
          </button>
          <button className={`tab-btn ${tab === "sightings" ? "active" : ""}`} onClick={() => setTab("sightings")}>
            <Compass size={15} /> My Sightings ({checkedCount})
          </button>
        </div>

        {tab === "guide" && (
          <>
            <div className="controls">
              <div className="search-box">
                <Search size={16} className="icon-muted" />
                <input type="text" placeholder="Search by name, region, or family…" value={query} onChange={(e) => setQuery(e.target.value)} />
                {query && <button className="clear-btn" onClick={() => setQuery("")} aria-label="Clear search"><X size={15} /></button>}
              </div>
            </div>

            <div className="filter-group">
              <p className="filter-label">Type — pick one</p>
              <div className="chip-row">
                <span className={`chip ${typeFilter === "All" ? "active" : ""}`} onClick={() => setTypeFilter("All")}>All</span>
                {TYPES.map((t) => (
                  <span key={t} className={`chip ${typeFilter === t ? "active" : ""}`} onClick={() => setTypeFilter(typeFilter === t ? "All" : t)}>{t}</span>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <p className="filter-label">Continent — pick any</p>
              <div className="chip-row">
                {CONTINENTS.map((c) => (
                  <span key={c} className={`chip ${continentFilters.includes(c) ? "active" : ""}`} onClick={() => toggleContinent(c)}>{c}</span>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <p className="filter-label">More</p>
              <div className="chip-row">
                <span className={`chip ${exoticOnly ? "active" : ""}`} onClick={() => setExoticOnly((v) => !v)}>Exotic (non-North American)</span>
                <span className={`chip venom ${venomousOnly ? "active" : ""}`} onClick={() => setVenomousOnly((v) => !v)}>Venomous only</span>
              </div>
            </div>

            <p className="result-count">{loaded ? `${guideResults.length} species` : "loading your checklist…"}</p>
          </>
        )}

        {tab === "sightings" && (
          <p className="result-count">{loaded ? `${sightings.length} snake${sightings.length === 1 ? "" : "s"} logged` : "loading your checklist…"}</p>
        )}

        {activeList.length === 0 ? (
          <p className="empty-state">
            {tab === "guide" ? "No snakes found." : "You haven't logged any sightings yet — find one in the Field Guide and tap Seen."}
          </p>
        ) : (
          <div className="grid">
            {activeList.map((s) => {
              const isDone = !!checked[s.id];
              return (
                <div key={s.id} className={`card ${isDone ? "done" : ""}`}>
                  <div className="card-top">
                    <div>
                      <div className="card-name">{s.name}</div>
                      <div className="card-sci">{s.sci}</div>
                    </div>
                  </div>
                  <div className="card-tags">
                    <span className="tag"><MapPin size={10} />{s.region}</span>
                    <span className="tag">{s.type}</span>
                    <span className="tag">{SIZE_LABEL[s.size]}</span>
                    {s.venomous && <span className="tag venom">Venomous</span>}
                  </div>
                  <div className="card-bottom">
                    {isDone && <span className="seen-date">Seen {dateFmt(checked[s.id])}</span>}
                    <button className={`seen-btn ${isDone ? "done" : ""}`} onClick={() => toggleSeen(s.id)}>
                      {isDone ? <Check size={13} /> : null} {isDone ? "Seen" : "Mark Seen"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

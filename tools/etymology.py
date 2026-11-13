"""Where a snake's names come from, for the species pages ("What the name means").

Only what the name itself shows is explained, and nothing is guessed:
  * the species epithet (the second word of the scientific name):
      - Latin and Greek describing words (viridis = green, melanocephalus = black head), from the
        roots below, only when the whole word splits into known roots;
      - place names (yunnanensis = from Yunnan), from PLACES or from the places the snake lives;
      - people (amarali = named after Amaral): only the plain -i / -ii endings, which always mean
        "of <surname>"; who the person was is said only for the well-known people in HONOREES;
        -ae / -orum / -arum names are only explained when they are listed here;
  * the genus, when data/genus-info.json has no sourced meaning, only when it splits completely
    into known Greek/Latin roots;
  * the common name: the describing words it is made of (colours, body parts, habitats, the
    person in "Amaral's"), and the well-known snake words (racer, keelback, kukri...).
Words that are not understood are simply left out.
"""
import re, unicodedata

# ---------------------------------------------------------------- roots
# combining roots that come first in a compound: form -> (meaning, language, kind)
#   kind: c = colour, n = number/amount, s = size or shape, p = part of the body, t = pattern, x = other
PRE = {}
def _pre(kind, lang, forms, gloss):
    for f in forms.split(): PRE[f] = (gloss, lang, kind)
_pre("c", "L", "nigr nigri nigro", "black"); _pre("c", "L", "atr atri atro", "black")
_pre("c", "G", "melan melano mela", "black"); _pre("c", "G", "leuc leuco", "white")
_pre("c", "L", "alb albi albo", "white"); _pre("c", "G", "xanth xantho", "yellow")
_pre("c", "L", "flav flavi flavo", "yellow"); _pre("c", "L", "lute luteo", "yellow")
_pre("c", "G", "chlor chloro", "green"); _pre("c", "L", "virid viridi", "green")
_pre("c", "G", "erythr erythro", "red"); _pre("c", "L", "rubr rubri rubro", "red")
_pre("c", "G", "rhod rhodo", "rose-red"); _pre("c", "L", "ruf rufi rufo", "reddish")
_pre("c", "G", "cyan cyano", "blue"); _pre("c", "L", "caerule coerule caeruleo coeruleo", "blue")
_pre("c", "L", "fusc fusci fusco", "dark brown"); _pre("c", "L", "purpure purpureo", "purple")
_pre("c", "L", "aur auri auro aure aureo", "golden"); _pre("c", "G", "chrys chryso", "golden")
_pre("c", "L", "argent argenti", "silver"); _pre("c", "L", "grise griseo grisei", "grey")
_pre("c", "L", "cinere", "ash-grey"); _pre("c", "L", "plumb plumbi", "lead-grey")
_pre("c", "G", "poecil poecilo", "many-coloured"); _pre("c", "G", "pyrrh pyrrho", "flame-red")
_pre("c", "G", "porphyr", "purple"); _pre("c", "G", "haemat haemato", "blood-red")
_pre("c", "L", "sanguin", "blood-red"); _pre("c", "G", "ochr ochro", "pale yellow")
_pre("c", "L", "olivac", "olive"); _pre("c", "L", "castan", "chestnut")
_pre("c", "G", "glauc", "blue-grey"); _pre("c", "L", "fulv fulvi fulvo", "tawny")
_pre("c", "L", "lacte", "milky white"); _pre("c", "G", "callo calli", "beautiful")
_pre("n", "L", "uni", "one"); _pre("n", "G", "mono", "one"); _pre("n", "L", "bi", "two"); _pre("n", "G", "di", "two")
_pre("n", "L", "tri", "three"); _pre("n", "L", "quadri quadr quatuor", "four")
_pre("n", "G", "tetra", "four"); _pre("n", "L", "quinque", "five"); _pre("n", "G", "penta", "five")
_pre("n", "L", "sex", "six"); _pre("n", "G", "hexa", "six"); _pre("n", "L", "septem", "seven")
_pre("n", "L", "octo", "eight"); _pre("n", "L", "decem", "ten"); _pre("n", "L", "undecim", "eleven")
_pre("n", "L", "multi", "many"); _pre("n", "G", "poly", "many"); _pre("n", "L", "pauci", "few")
_pre("n", "G", "oligo", "few"); _pre("n", "L", "semi", "half"); _pre("n", "G", "hemi", "half")
_pre("s", "G", "macr macro", "large"); _pre("s", "G", "micr micro", "small"); _pre("s", "G", "lepto lept", "slender")
_pre("s", "G", "brachy", "short"); _pre("s", "L", "brev brevi", "short"); _pre("s", "L", "long longi", "long")
_pre("s", "L", "lati", "broad"); _pre("s", "L", "angusti", "narrow"); _pre("s", "L", "tenui", "thin")
_pre("s", "G", "platy", "flat"); _pre("s", "G", "steno", "narrow"); _pre("s", "L", "crassi", "thick")
_pre("s", "G", "pachy", "thick"); _pre("s", "G", "mega megalo", "big"); _pre("s", "L", "acuti", "pointed")
_pre("s", "G", "oxy", "sharp"); _pre("s", "L", "obtusi", "blunt"); _pre("s", "L", "grandi", "big")
_pre("s", "L", "parvi", "small"); _pre("s", "G", "eury", "wide"); _pre("s", "G", "dolicho", "long")
_pre("s", "G", "trachy", "rough"); _pre("s", "G", "lio leio", "smooth"); _pre("s", "G", "homo homa", "same")
_pre("s", "G", "hetero", "different"); _pre("s", "G", "iso", "equal"); _pre("s", "G", "aniso", "unequal")
_pre("s", "G", "cyclo", "round"); _pre("s", "G", "acro", "tip"); _pre("s", "G", "calli callo", "beautiful")
_pre("t", "L", "maculi maculo", "spotted"); _pre("t", "L", "puncti puncto", "dotted"); _pre("t", "L", "lineo", "lined")
_pre("t", "L", "annuli", "ringed"); _pre("t", "G", "spilo", "spotted"); _pre("t", "L", "striati", "striped")
_pre("t", "L", "ornati", "decorated"); _pre("t", "L", "fasci", "banded")
_pre("p", "L", "ventri ventro", "belly"); _pre("p", "L", "dorsi dorso", "back"); _pre("p", "G", "gastro", "belly")
_pre("p", "G", "noto", "back"); _pre("p", "L", "caudi caudo", "tail"); _pre("p", "G", "cephalo", "head")
_pre("p", "L", "labio", "lip"); _pre("p", "L", "colli", "neck"); _pre("p", "G", "pleuro", "side")
_pre("p", "L", "latero", "side"); _pre("p", "L", "oculo", "eye"); _pre("p", "L", "occipito", "back of the head")
_pre("p", "L", "vertebro", "backbone"); _pre("p", "L", "pulveri", "dust")

# roots that end a compound: (forms, meaning, language, kind)  kind: n = noun, a = describing word, d = "-loving/-eating" etc.
FIN = {}
def _fin(kind, lang, forms, gloss):
    for f in forms.split(): FIN[f] = (gloss, lang, kind)
_fin("n", "L", "ceps", "head"); _fin("n", "G", "cephalus cephala cephalum", "head")
_fin("n", "L", "cauda", "tail"); _fin("a", "L", "caudatus caudata caudatum", "tailed")
_fin("n", "G", "urus ura urum", "tail"); _fin("n", "G", "cercus cerca cercos", "tail")
_fin("n", "G", "lepis", "scales"); _fin("a", "G", "lepidotus lepidota lepidotum", "scaled")
_fin("n", "G", "pholis", "scales"); _fin("n", "G", "gaster", "belly"); _fin("n", "L", "venter ventris", "belly")
_fin("n", "G", "notus nota notum", "back"); _fin("n", "G", "rhynchus rhyncha rhynchum", "snout")
_fin("a", "L", "rostris rostre", "snouted"); _fin("n", "G", "ops", "eye"); _fin("n", "G", "ophthalmus ophthalma ophthalmum", "eye")
_fin("n", "L", "dens", "teeth"); _fin("n", "G", "odon odus", "teeth"); _fin("n", "G", "gnathus", "jaw")
_fin("a", "L", "labris", "lipped"); _fin("n", "G", "cheilus", "lip"); _fin("n", "G", "stoma stomus", "mouth")
_fin("a", "L", "collis", "necked"); _fin("a", "L", "frons", "fronted"); _fin("n", "G", "soma", "body")
_fin("n", "G", "derma dermus", "skin"); _fin("n", "G", "zonus zona zonum", "band")
_fin("a", "L", "zonatus zonata zonatum", "banded"); _fin("a", "L", "cinctus cincta cinctum", "banded")
_fin("a", "L", "lineatus lineata lineatum", "lined"); _fin("a", "L", "lineolatus lineolata", "finely lined")
_fin("a", "L", "maculatus maculata maculatum", "spotted"); _fin("a", "L", "punctatus punctata punctatum", "dotted")
_fin("a", "L", "fasciatus fasciata fasciatum", "banded"); _fin("a", "L", "vittatus vittata vittatum", "striped")
_fin("a", "L", "virgatus virgata virgatum", "striped"); _fin("a", "L", "striatus striata striatum", "striped")
_fin("a", "L", "taeniatus taeniata taeniatum", "striped"); _fin("a", "L", "annulatus annulata annulatum", "ringed")
_fin("a", "L", "ocellatus ocellata ocellatum", "eye-spotted"); _fin("a", "G", "stictus sticta stictum", "spotted")
_fin("a", "G", "spilus spilotus spilota", "spotted"); _fin("n", "G", "grammus gramma", "lines")
_fin("n", "L", "color", "colour"); _fin("a", "L", "colorata coloratus", "coloured"); _fin("a", "G", "chrous chroa", "coloured")
_fin("a", "L", "carinatus carinata carinatum", "keeled"); _fin("a", "L", "scutatus scutata", "shielded")
_fin("a", "L", "torquatus torquata torquatum", "collared"); _fin("a", "L", "torques", "collared")
_fin("a", "L", "squamatus squamata", "scaled"); _fin("a", "L", "tuberculatus", "warty")
_fin("d", "L", "cola", "living on"); _fin("d", "L", "vorus vora", "eating"); _fin("d", "G", "phagus", "eating")
_fin("d", "G", "philus phila", "loving"); _fin("d", "L", "formis", "-shaped"); _fin("d", "G", "oides", "-like")
_fin("d", "G", "phorus phora", "carrying"); _fin("n", "G", "ophis", "snake")
# body-part describing words that also end compounds (latifrontalis, nigriventris...)
_fin("n", "L", "frontalis", "forehead"); _fin("n", "L", "gularis", "throat"); _fin("n", "L", "labialis", "lip")
_fin("n", "L", "nuchalis", "nape"); _fin("n", "L", "collaris", "collar"); _fin("n", "L", "dorsalis", "back")
_fin("n", "L", "ventralis", "belly"); _fin("n", "L", "ventris", "belly"); _fin("n", "L", "ocularis", "eye")
_fin("n", "L", "temporalis", "temple scales")
# the same body parts as nouns, for "nigriceps" etc. are above; colour words that end a compound
_fin("c", "L", "nigrum niger nigra", "black"); _fin("c", "G", "melas", "black")

# whole words: the commonest Latin and Greek epithets  (form: meaning)
WORDS_RAW = """
bicolor=two-coloured|unicolor=one-coloured, without a pattern|concolor=all one colour|tricolor=three-coloured|discolor=of different colours
lineatus lineata lineatum=lined|modestus modesta=modest, plain|gracilis gracile=slender|collaris=with a collar|elegans=elegant
monticola=mountain-dweller|inornatus inornata=without decoration, plain|australis=southern|maculatus maculata maculatum=spotted
ater atra=black|nuchalis nuchale=of the nape (the back of the neck)|ocellatus ocellata=with eye-spots|annulatus annulata=ringed
occidentalis=western|lateralis laterale=of the side|affinis=related (similar to another species)|dorsalis=of the back
reticulatus reticulata=net-patterned|vittatus vittata vittatum=striped|carinatus carinata carinatum=keeled (ridged scales)
anomalus anomala=unusual|fuscus fusca fuscum=dark brown|septentrionalis=northern|occipitalis=of the back of the head
fasciatus fasciata fasciatum=banded|vertebralis=of the backbone|punctatus punctata punctatum=dotted|laevis laeve=smooth
taeniatus taeniata taeniatum=striped|ornatus ornata ornatum=decorated|frontalis=of the forehead|niger nigra nigrum=black
viridis=green|pulcher pulchra pulchrum=beautiful|scalaris=ladder-like|pictus picta=painted|longissimus=very long
variegatus variegata variegatum=variegated (with patches of different colours)|depressus=flattened|antiqua antiquus=ancient
sanguineus=blood-red|tenuis=thin|variabilis=variable|olivaceus olivacea=olive-coloured|fuliginosus fuliginosa=sooty
major=larger|fallax=deceptive|acutus acuta=pointed|punctulatus=finely dotted|atratus atrata=dressed in black
fasciolatus fasciolata=with small bands|strigatus=streaked|intermedius intermedia=intermediate|labialis=of the lips
grandis=large|rufescens=reddish|guttatus guttata=spotted (as if with drops)|lemniscatus lemniscata=ribboned
irregularis=irregular|frenatus frenata frenatum=bridled|gigas=giant|brevis=short|spinalis=of the spine|diadema=crown
arenarius arenaria=of sand|alternans=alternating|meridionalis meridionale=southern|striatus striata=striped|curtus curta=short
lineolatus=with fine lines|insularis=of islands|torquatus torquata torquatum=collared|filiformis=thread-shaped|lividus livida=bluish-grey
zebrinus=zebra-striped|subflavus=yellowish|littoralis=of the shore|problematicus=puzzling|mosaicus=mosaic-patterned
borealis=northern|linearis=lined|geminatus=paired|dubius=doubtful|pygmaeus pygmaeum=pygmy, very small|nebulosus nebulosa=clouded
brunneus brunneum=brown|montanus montana montanum=of mountains|undulatus undulata=wavy|atrox=fierce|ruber rubra=red
horridus=bristly, rough|pusillus=very small|venustus=charming|mutabilis=changeable|porrectus=stretched out|rugosus rugosa=wrinkled
scutatus=shielded|vermiformis=worm-shaped|minimus=smallest|cucullatus cucullata=hooded|nasutus nasuta nasutum=big-nosed
coronatus coronata=crowned|pulverulenta pulverulentus=dusty|splendidus splendida=splendid|formosus=beautiful
triangularis=triangular|pulcherrimus=most beautiful|tessellatus tessellata tesselata=chequered|proximus=nearest|exsul=exile
leopardinus=leopard-like|paradoxus=unexpected|tristis=sad, dull-coloured|constrictor=squeezer|maculosa maculosus=spotted
maurus=dark, Moorish|miliaris miliarius=with millet-seed spots|pallidus pallida=pale|similis simile=similar|parvus parva=small
caerulescens=bluish|aureus=golden|signatus signata=marked|alternatus=alternating|semicinctus semicincta semicinctum=half-banded
splendidus=splendid|catenatus=chained|serrana serranus=of the mountains|plumbea=lead-grey|elegantissimus=most elegant
simus=snub-nosed|lepidus=pretty|robustus robusta=sturdy|exiguus exiguum=tiny|obscurus=dark|cerberus=Cerberus (the dog guarding the underworld)
medusa=Medusa (the snake-haired monster)|flagellum=whip|cinereus=ash-grey|amethystinus amethistina=amethyst-coloured
excelsa=tall, lofty|vagrans vagus=wandering|cognatus=related|stygius=of the River Styx (dark)|cincta=banded|nana nanus=dwarf
attenuatus attenuata=tapering|confusus confusa=confused (mixed up with another species)|hispida=bristly|hirsuta=hairy
squamigera=scale-bearing|cornutus cornuta=horned|tigris=tiger|aspis=asp, small viper|transversus=crosswise
basiliscus=little king|molossus=Molossian hound|superciliaris superciliosa=with eyebrows
armata=armed|rhinoceros=rhinoceros|nitida nitidus=shining|ocellata=with eye-spots|simplex=simple|par=equal
antarcticus=southern|minor=smaller|monachus=monk|superbus=proud, splendid|scytale=staff, a kind of snake
auratus=golden|chrysargos=golden-white|tigrinus=tiger-like|typus=type|vivax=lively|dispar=unequal, different
prasina prasinum=leek-green|psammophis=sand snake|bellus bella=pretty|elongatus=lengthened|truncatus=cut short
picturatus=painted|ambigua=uncertain|laevissimus=very smooth|fuscum=dark brown|pulchrum=beautiful|pallidus=pale
rutilus=reddish|doliatus=barrel-hooped (ringed)|vulpinus=fox-like|obsoletus=faint, indistinct|virgatus=striped
geometricus=geometric|aurora=dawn|mimus=mimic|sagittarius=archer|rubra=red|robusta=sturdy|relicta=left behind, a relic
varius=varied|dimorphus=two-shaped|argenteus=silver|amoenus amoena=pleasant|vermis=worm|radix=root|mendax=liar, deceiver
validus=strong|eques=knight, horseman|angulatus angulata=angled|nebulatus=clouded|argus=Argus (the hundred-eyed giant)
discolor=of different colours|assimilis=similar|vernalis=of spring|nummifer=coin-bearing|coccinea=scarlet
imperator=emperor|regius=royal|aspera asper=rough|lubricus=slippery|nivea=snowy white|caeca=blind|debilis=weak
sulcatus=furrowed|lacteus=milky white|crassus crassa=thick|vetus=old|priscus=ancient|xenos=stranger|dulcis=sweet
humilis=low, humble|propinquus=near, related|ancorus=anchor|melaneus=blackish|rigida=stiff|incerta=uncertain
articulata=jointed|acuta=pointed|cana canum canus=grey|nasus=nose|natans=swimming|melas=black|obesus=fat|ferox=fierce
radiatus=rayed|zonata=banded|alterna=alternating|triangulum=triangle|nympha=nymph|candidus=shining white|tener=tender
remotus=far away|decoratus decorata=decorated|notatus=marked|typica=typical|compressus=squeezed flat|cervinus=deer-coloured
sibilans=hissing|crucifer crucifera=cross-bearing|cupreus=copper-coloured|severus=severe|spiralis=spiral|cursor=runner
parva=small|bella=pretty|mirus=wonderful|funereus=funereal, dark|marmoratus=marbled|pubescens=downy|badius=chestnut-brown
lugubris=mournful, dark|tectus=covered|errans=wandering|tenella=delicate|gramineus=grassy (grass-green)|muta=silent
fossor=digger|spinosus=spiny|textilis=woven|cameratus=vaulted|arcuatus=arched|pardalis=leopard|spectabilis=remarkable
caeruleus=blue|magna=great|imperialis=imperial|pinguis=fat|rudis=rough|ruffus=reddish|hamatus=hooked|diversus=different
occultus=hidden|rusticus=rustic|distans=distant|jaculus=javelin|nigricans=blackish|nigrescens=blackish|viridescens=greenish
flavescens=yellowish|purpurascens=purplish|rubescens=reddish|iridescens=iridescent|melanoleucus melanoleuca=black and white
leucomelas=white and black|erythromelas=red and black|chloromelas=green and black|nigroalbus=black and white
rhombifer rhombifera=bearing diamond shapes|rhombeatus=diamond-patterned|piscator=fisherman|piscivorus=fish-eating
ophiophagus=snake-eating|lumbricoidea=worm-like|lumbriciformis=worm-shaped|lumbricalis=worm-like|vermicularis=worm-like
viperinus viperina=viper-like|colubrinus colubrina=snake-like|elapoides=like a coral snake (Elaps)|anilioides=like Anilius
hydroides=water-snake-like|crotaloides=like a rattlesnake|bungaroides=like a krait (Bungarus)|cyclopion=round-eyed
scabra=rough|lunulatus=with little moons|granulatus=grainy|conicus=cone-shaped|vittata=striped
murinus=mouse-coloured|regularis=regular|ochraceus ochracea=ochre-coloured|lateritius=brick-red|incomptus=unadorned
minuta=tiny|ultima=last|insignitus=distinguished|incognitus=unknown|inornata=plain|calamarius calamaria=reed-like
reticulata=net-patterned|tropidonotus=keel-backed|sirtalis=like a garter|melanurus melanura=black-tailed
rufiventris=red-bellied|flaviventris=yellow-bellied|albiventris albiventer=white-bellied|nigriventer nigriventris=black-bellied
erythrogaster=red-bellied|melanogaster=black-bellied|leucogaster=white-bellied|rhodogaster=rose-bellied
calligaster=beautiful belly|xanthogaster=yellow-bellied|chrysogaster=golden-bellied|flaviventer=yellow-bellied
microcephalus=small-headed|brachycephalus=short-headed|platycephalus=flat-headed|leucocephalus=white-headed
megalocephalus=big-headed|chrysocephalus=golden-headed|melanocephalus melanocephala=black-headed
microlepis=small-scaled|macrolepis=large-scaled|polylepis=many-scaled|oligolepis=few-scaled|isolepis=equal-scaled
macrops=big-eyed|microps=small-eyed|miops=small-eyed|anops=eyeless|macrorhyncha=big-snouted|oxyrhynchus oxyrhyncha=sharp-snouted
brevirostris=short-snouted|longirostris=long-snouted|acutirostris=sharp-snouted|latirostris=broad-snouted
nigriceps=black-headed|atriceps=black-headed|albiceps=white-headed|flaviceps=yellow-headed|ruficeps=red-headed
planiceps=flat-headed|laticeps=broad-headed|breviceps=short-headed|longiceps=long-headed|angusticeps=narrow-headed
longicauda=long-tailed|brevicauda=short-tailed|nigricauda=black-tailed|longicaudata longicaudatus=long-tailed
heterurus=different-tailed|erythrurus=red-tailed|leucurus=white-tailed|xenura=strange tail|macrura macrurus=long-tailed
paucidens=few-toothed|fissidens=split-toothed|cynodon=dog-toothed|megalodon=big-toothed
boa=boa, a big snake|naja=naja, a word for cobra (from Sanskrit naga)|natrix=water snake|vipera=viper|berus=a kind of snake
coronella=little crown|elaps=a kind of snake|krait=krait|cerastes=horned|ammodytes=sand-burrower|ahaetulla=Ahaetulla (a Sinhalese name)
dipsas=a thirst-causing snake of legend|echidna=Echidna (a snake-woman of Greek myth)|typhlus=blind|naja=cobra
hannah=Hanna (a name for the king cobra)|haje=haje, the Arabic name of the Egyptian cobra|python=python
phoenix=phoenix|hades=Hades (the Greek underworld)|atlas=Atlas (a giant of Greek myth)|persephone=Persephone (queen of the Greek underworld)
odysseus=Odysseus (the Greek hero)|eurydice=Eurydice (from Greek myth)|calypso=Calypso (a nymph of Greek myth)
typhon=Typhon (a monster of Greek myth)|apophis=Apophis (the serpent of Egyptian myth)|hephaestus=Hephaestus (the Greek god of fire)
tartarus=Tartarus (the Greek underworld)|avernus=Avernus (the Roman entrance to the underworld)|acheronius=of the Acheron (a river of the Greek underworld)
ehecatl=Ehecatl (the Aztec wind god)|tzabcan=tzabcan (the Maya word for rattlesnake)|surucucu=surucucu (a Tupi name for the bushmaster)
jararaca=jararaca (a Tupi name)|jararacussu=jararacussu (a Tupi name)|zigzag=zigzag|aenigma=riddle|phantasma=ghost
lacrima=tear|aurifer=gold-bearing|annulifer annulifera=ring-bearing|quadriocellatus=with four eye-spots
vertebrolineatus=with a line along the backbone|orientalis=eastern|alticola=dweller of high places|aquaticus=living in water
arietans=striking (like a butting ram)|atropos=Atropos (one of the three Fates of Greek myth)|auriculatus=eared|austrinus=southern
azurea=sky-blue|balteatus=belted|bambusicola=bamboo-dweller|bellulus=pretty|bipartitus=divided in two|bistrigatus=two-streaked
braminus=Brahmin|caesar=Caesar|caninus=dog-like|capistrata=wearing a halter|carinicaudus=keel-tailed|catenifer=chain-bearing
cavernicolus=cave-dweller|caudalis=of the tail|centralis=central|chalybeus=steel-blue|chloroticus=greenish|citrinus=lemon-yellow
clathratus=latticed|coloratus=coloured|conspicillatus conspicillata=spectacled|continentalis=of the mainland|contortrix=twister
corallinus=coral-red|cordata=heart-shaped|cruentatus=blood-stained|cuniculator=burrower|cyanea=dark blue|decipiens=deceiving
decorosus=handsome|deserti=of the desert|deserticola=desert-dweller|dimidiatus dimidiata=halved|dissimilis=unlike
dendrophila=tree-loving|dendrophis=tree snake|ellipsifer ellipsifera=bearing ellipses|ephippifer=saddle-bearing
episcopus episcopa=bishop|errabunda=wandering|flammigerus=flame-bearing|fulgidus=shining|fulvius fulvus=tawny|gularis=of the throat
haemachatus=blood-red agate|hippocrepis=horseshoe (from the Greek for a horse's shoe)|hortulana=of gardens|igneus=fiery
immaculatus=without spots|imbricata=overlapping, like roof tiles|incredibilis=unbelievable|indistinctus=indistinct
isabellina=isabelline (a greyish-yellow colour)|jugularis=of the throat|lanceolatus=lance-shaped|leucomystax=white moustache
limbatus=bordered|lineaticollis=lined neck|lutosus=muddy|macularius=spotted|magnimaculatus magnamaculata=large-spotted
margaritiferus=pearl-bearing|margaritophorus margaritophora=pearl-bearing|maxima=largest|melanogenys=black cheeks
meleagris=guineafowl (spotted like one)|miniatus=vermilion-red|multisquamis=many-scaled|nasalis=of the nose|nasicornis=nose-horned
nauta=sailor|nigroviridis=black and green|nigroluteus=black and yellow|obtusus=blunt|ocularis=of the eye|ornatissimus ornatissima=most decorated
pacificus=of the Pacific|pallidiceps=pale-headed|paradisi=of paradise|pavonina=peacock-like|platurus=flat-tailed|porphyriacus=purple
praelongus=very long|primitivus=primitive|pyrrhus=flame-red|pyromelana=fire-red and black|quadrangulare=four-angled
resplendens=shining|rhombomaculata=diamond-spotted|rostratus rostrata=beaked|rostralis=of the snout|rubida=reddish
rufidorsa=red-backed|rufodorsatus=red-backed|rufulus=reddish|scutulatus=with a pattern of small diamonds|schistosus schistosa schistosum=slate-grey
scriptum=written (marked as if with writing)|semiaureus=half golden|semiornatus=half decorated|semivariegatus=partly variegated
serra=saw|serratus=saw-edged|smaragdinus=emerald-green|solivagus=wandering alone|spilota=spotted|sputatrix=spitter
squamosus=scaly|striatula=finely striped|subocularis=below the eye|subminiatus=reddish|sulphureus=sulphur-yellow
sylvatica=of the woods|sylvicolus=forest-dweller|talpivorus=mole-eating|taeniurus taeniura=striped tail|terrificus=terrifying
thalassinus=sea-green|tigerinus=tiger-like|titanicus=gigantic|torrenicola=dweller of mountain torrents|trigonocephalus=triangular head
trigonatus trigonata=marked with triangles|triseriatus triseriata=in three rows|troglodytes=cave-dweller|turgida=swollen
umbratica=shady|varia=varied|vermiculata=worm-patterned|violacea violaceus=violet|viridiflavus=green and yellow
viridissimum=very green|volcanicum=of volcanoes|xanthina=yellowish|xerophila=dry-loving|sublineatus=faintly lined
subcinctus=partly banded|subannulatus=partly ringed|subpunctatus=faintly dotted|subtaeniatus subtaeniata=faintly striped
supraciliaris=with scales like eyebrows|taxispilota=spotted in rows|tergeminus=threefold|trianguligerus=triangle-bearing
venustissimus=most charming|tenuissimus tenuissima=very thin|temporalis=of the temples|tecta=covered|gracillima=very slender
gracilior=more slender|brevissima=very short|praelongissima=extremely long|prolixum=long|procerum=tall|pulchriceps=beautiful head
atraventer=black belly|melanolabiatus=black-lipped|melanostigma=black-spotted|nigrilatus nigrilatum=black-sided
nigromarginata=black-edged|nigroterminata nigroterminus=black-tipped|multidentatus=many-toothed|obscuriventris=dark belly
pantostictus=spotted all over|polygrammicus=many-lined|infralineatus=lined underneath|coronelloides=like a smooth snake (Coronella)
arcana=secret|illusorium=illusion|enigma=riddle|papilio=butterfly|lambda=the Greek letter lambda (λ)|tau=the Greek letter tau (τ)
"""
WORDS = {}
for _ln in WORDS_RAW.strip().splitlines():
    for _it in _ln.split("|"):
        if "=" not in _it: continue
        _fs, _g = _it.split("=", 1)
        for _f in _fs.split(): WORDS.setdefault(_f, _g)

# place-name adjectives (-anus, -icus, -inus...) and nouns: word -> place
PLACE_WORDS = {
    "mexicanus": "Mexico", "mexicana": "Mexico", "americanus": "America", "africanus": "Africa", "indicus": "India", "indica": "India",
    "japonicus": "Japan", "javanicus": "Java", "javanica": "Java", "sumatranus": "Sumatra", "sumatrana": "Sumatra", "philippinus": "the Philippines",
    "philippina": "the Philippines", "persicus": "Persia (Iran)", "arabicus": "Arabia", "arabica": "Arabia", "aegyptius": "Egypt", "aegyptia": "Egypt",
    "caucasicus": "the Caucasus", "syriacus": "Syria", "somalicus": "Somalia", "somalica": "Somalia", "ceylonicus": "Ceylon (Sri Lanka)",
    "ceylanica": "Ceylon (Sri Lanka)", "travancoricus": "Travancore (southern India)", "travancorica": "Travancore (southern India)",
    "himalayanus": "the Himalayas", "formosanus": "Formosa (Taiwan)", "peruvianus": "Peru", "peruviana": "Peru", "peruana": "Peru",
    "colombianus": "Colombia", "boliviana": "Bolivia", "argentinus": "Argentina", "patagonica": "Patagonia", "floridana": "Florida",
    "hungaricus": "Hungary", "iberica": "Iberia (Spain and Portugal)", "gallicus": "Gaul (France)", "graeca": "Greece", "helvetica": "Helvetia (Switzerland)",
    "illyrica": "Illyria (the western Balkans)", "austriaca": "Austria", "sarmatica": "Sarmatia (the lands north of the Black Sea)",
    "ukrainica": "Ukraine", "europaeus": "Europe", "europae": "Europe", "mauritanicus": "Mauretania (north-west Africa)", "mauritanica": "Mauretania (north-west Africa)",
    "tripolitanus": "Tripoli", "abyssinicus": "Abyssinia (Ethiopia)", "abyssina": "Abyssinia (Ethiopia)", "mossambicus": "Mozambique",
    "mossambica": "Mozambique", "mossambicanus": "Mozambique", "congica": "the Congo", "gabonica": "Gabon", "usambaricus": "the Usambara Mountains",
    "tanganicus": "Tanganyika", "aethiopicus": "Aethiopia (an old name for Africa south of Egypt)", "monspessulanus": "Montpellier (France)",
    "ruandae": "Ruanda (Rwanda)", "suevica": "Swabia (Germany)", "tanganicanus": "Tanganyika", "swazicus": "Swaziland (Eswatini)", "rhodesiana": "Rhodesia (Zimbabwe and Zambia)",
    "namibianum": "Namibia", "malabaricus": "the Malabar coast of India", "malabarica": "the Malabar coast of India", "burmanus": "Burma (Myanmar)",
    "malaccanus": "Malacca", "celebicus": "Celebes (Sulawesi)", "halmahericus": "Halmahera", "papuanus": "Papua", "papuana": "Papua",
    "torresianus": "the Torres Strait", "vitianus": "Viti (Fiji)", "victorianus": "Victoria (Australia)", "caribbaeus": "the Caribbean",
    "haetianus": "Haiti", "yucatanicum": "the Yucatán", "trinitatis": "Trinidad", "trinitatus": "Trinidad", "tibetanus": "Tibet", "altaica": "the Altai Mountains",
    "yemenica": "Yemen", "pakistanicus": "Pakistan", "luristanicus": "Luristan (Iran)", "rafsanjanicus": "Rafsanjan (Iran)", "kuhrangica": "Kuhrang (Iran)",
    "urartica": "Urartu (an ancient kingdom around Armenia)", "caspius": "the Caspian Sea", "meotica": "Lake Maeotis (the Sea of Azov)",
    "levantinus": "the Levant", "palaestinae": "Palestine", "anatolica": "Anatolia", "transcaucasiana": "Transcaucasia",
    "maghrebiana": "the Maghreb", "maghrebianus": "the Maghreb", "algirus": "Algiers", "occitanus": "Occitania (southern France)",
    "girondica": "the Gironde (France)", "oxiana": "the Oxus River (Amu Darya)", "sindanus": "Sind (Pakistan)", "taprobanica": "Taprobane (Sri Lanka)",
    "lojanus": "Loja (Ecuador)", "cuyanus": "the Cuyo region of Argentina", "pastusa": "Pasto (Colombia)", "tapajonicus": "the Tapajós River",
    "andinus": "the Andes", "andianus": "the Andes", "andiana": "the Andes", "andinista": "the Andes", "transandinus": "the far side of the Andes",
    "amazonica": "the Amazon", "equatoriana": "Ecuador", "colombia": "Colombia", "betsileanus": "the Betsileo region of Madagascar",
    "omiltemanus": "Omiltemi (Mexico)", "omiltemana": "Omiltemi (Mexico)", "canaricus": None, "europaea": "Europe", "germanica": "Germany",
    "yemenicus": "Yemen", "saharicus": "the Sahara", "bulgardaghica": "the Bulgar Dagh mountains (Turkey)", "socotranus": "Socotra",
    "socotrae": "Socotra", "nubiae": "Nubia", "arafurae": "the Arafura Sea", "californiae": "California", "novaeguineae": "New Guinea",
    "cornusafricae": "the Horn of Africa", "pembae": "Pemba Island", "pembana": "Pemba Island", "pembanum": "Pemba Island", "misimae": "Misima Island",
    "imerinae": "Imerina (Madagascar)", "nyassae": "Lake Nyasa (Malawi)", "rukwae": "Lake Rukwa", "akagerae": "the Akagera (Rwanda)",
    "upembae": "Upemba (Congo)", "talamancae": "the Talamanca mountains", "oaxacae": "Oaxaca", "sanctaemartae": "the Santa Marta mountains (Colombia)",
    "veraepacis": "Verapaz (Guatemala)", "sanctaecrucis": "Santa Cruz", "marcapatae": "Marcapata (Peru)", "laurasiae": "Laurasia (an ancient supercontinent)",
    "antiguae": "Antigua", "gezirae": "the Gezira (Sudan)", "europaeum": "Europe", "dominicanus": None, "ruatanus": "Roatán (Honduras)",
    "caymanus": "the Cayman Islands", "insulanus": "an island", "isthmicus": None, "miskitus": None, "montecristi": None,
    "tanahjampeana": "Tanah Jampea (Indonesia)", "bangweolicus": "Lake Bangweulu (Zambia)", "tiomanica": "Tioman Island (Malaysia)",
    "phangan": "Ko Pha Ngan (Thailand)", "huahin": "Hua Hin (Thailand)", "saiyok": "Sai Yok (Thailand)", "gongshan": "Gongshan (China)",
    "cuneirostris": None, "kyaiktiyo": "Kyaiktiyo (Myanmar)", "yaquia": "the Yaqui", "teitana": "the Taita Hills (Kenya)",
}
# -ensis places that the stem alone would not show; checked by hand
PLACES = {
    "mlanjensis": "Mlanje (Mulanje) Mountain in Malawi", "yanbianensis": "Yanbian (China)", "keyensis": "the Kei Islands", "keiensis": "the Kei Islands",
    "haihaensis": "Hai Ha (Vietnam)", "yunkaiensis": "the Yunkai Mountains (China)", "arunachalensis": "Arunachal Pradesh (India)",
    "sahyadrensis": "the Sahyadri (Western Ghats) of India", "sistanensis": "Sistan", "tranganensis": "Tràng An (Vietnam)", "menglaensis": "Mengla (China)",
    "estebanensis": "San Esteban Island (Mexico)", "xuelinensis": "Xuelin (China)", "sangzhiensis": "Sangzhi (China)", "borneensis": "Borneo",
    "kongoensis": "the Congo", "taronensis": "the Taron River valley", "pingbianensis": "Pingbian (China)", "muertensis": "El Muerto Island (Mexico)",
    "thanlyinensis": "Thanlyin (Myanmar)", "annamensis": "Annam (Vietnam)", "capensis": "the Cape (South Africa)", "capense": "the Cape (South Africa)",
    "goodenoughensis": "Goodenough Island", "yunnanensis": "Yunnan (China)", "ishigakiensis": "Ishigaki Island (Japan)", "sarawacensis": "Sarawak",
    "saravacense": "Sarawak", "chapaensis": "Chapa (Sa Pa, Vietnam)", "turpanensis": "Turpan (China)", "congolensis": "the Congo",
    "khasiensis": "the Khasi Hills (India)", "panzhihuaensis": "Panzhihua (China)", "zayuensis": "Zayü (Tibet)", "deccanensis": "the Deccan (India)",
    "nicobariensis": "the Nicobar Islands", "suluensis": "the Sulu Islands", "kerinciensis": "Kerinci (Sumatra)", "yingjiangensis": "Yingjiang (China)",
    "savuensis": "Savu Island", "honsonensis": "Hon Son Island (Vietnam)", "anamallensis": "the Anamalai Hills (India)", "dehuaensis": "Dehua (China)",
    "guayaquilensis": "Guayaquil (Ecuador)", "andalasensis": "Andalas (an old name for Sumatra)", "tchadensis": "Chad", "weixiensis": "Weixi (China)",
    "changdaoensis": "Changdao (China)", "hainanense": "Hainan", "hainanensis": "Hainan", "ningshanensis": "Ningshan (China)", "ningshaanensis": "Ningshan (China)",
    "chambensis": "Chamba (India)", "mayombensis": "the Mayombe forest", "youjiangensis": "the Youjiang (China)", "hunanensis": "Hunan (China)",
    "katangensis": "Katanga (Congo)", "rungweensis": "Mount Rungwe (Tanzania)", "tonkinensis": "Tonkin (northern Vietnam)", "okinavensis": "Okinawa",
    "tokarensis": "the Tokara Islands (Japan)", "xiangchengensis": "Xiangcheng (China)", "catalinensis": "Santa Catalina Island (Mexico)",
    "tancitarensis": "Tancítaro (Mexico)", "tortugensis": "Tortuga Island (Mexico)", "medoensis": "Mêdog (Tibet)", "ussuriensis": "the Ussuri River",
    "qinlingensis": "the Qinling Mountains (China)", "tsushimaensis": "Tsushima Island (Japan)", "shedaoensis": "Shedao Island (China)",
    "kanburiensis": "Kanchanaburi (Thailand)", "pungwensis": "the Pungwe River", "keniensis": "Mount Kenya", "aruensis": "the Aru Islands",
    "madurensis": "Madurai (India)", "pulneyensis": "the Palni (Pulney) Hills (India)", "dindigalensis": "Dindigul (India)", "darwiniensis": "Darwin (Australia)",
    "ordensis": "the Ord River (Australia)", "gentingensis": "Genting (Malaysia)", "murudensis": "Mount Murud (Borneo)", "baramensis": "the Baram River (Borneo)",
    "matogrossensis": "Mato Grosso (Brazil)", "mattogrossensis": "Mato Grosso (Brazil)", "uluguruensis": "the Uluguru Mountains (Tanzania)",
    "mayottensis": "Mayotte", "apurimacensis": "Apurímac (Peru)", "guianensis": "the Guianas", "formosensis": "Formosa (Taiwan)",
    "michoacanensis": "Michoacán (Mexico)", "thomensis": "São Tomé", "natalensis": "Natal (South Africa)", "ambreensis": "Montagne d'Ambre (Madagascar)",
    "patagoniensis": "Patagonia", "ceylonensis": "Ceylon (Sri Lanka)", "negrosensis": "Negros (Philippines)", "chaquensis": "the Chaco",
    "barotseensis": "Barotseland (Zambia)", "andresensis": "San Andrés Island (Colombia)", "sahelensis": "the Sahel", "antioquiensis": "Antioquia (Colombia)",
    "hidalgoensis": "Hidalgo (Mexico)", "uzungwense": "the Uzungwa (Udzungwa) Mountains (Tanzania)", "siamensis": "Siam (Thailand)",
    "guangxiensis": "Guangxi (China)", "bengkuluensis": "Bengkulu (Sumatra)", "meiguensis": "Meigu (China)", "cearensis": "Ceará (Brazil)",
    "goiasensis": "Goiás (Brazil)", "brasiliensis": "Brazil", "gemonensis": "Gemona (Italy)", "roatanensis": "Roatán (Honduras)", "perthensis": "Perth (Australia)",
    "oenpelliensis": "Oenpelli (Australia)", "mandalayensis": "Mandalay (Myanmar)", "samarensis": "Samar (Philippines)", "sudanensis": "the Sudan region",
    "gonavensis": "Gonâve Island (Haiti)", "transvaalensis": "the Transvaal (South Africa)", "sabiensis": "the Sabi (Save) River", "dahomeyensis": "Dahomey (Benin)",
    "engaddensis": "Ein Gedi (Engaddi)", "moeruensis": "Lake Mweru (Moero)", "australiensis": "Australia", "nebraskensis": "Nebraska", "kansensis": "Kansas",
    "marajoensis": "Marajó Island (Brazil)", "kheriensis": "Kheri (India)", "arnensis": "Arni (India)", "cardamomensis": "the Cardamom Mountains",
    "ceramensis": "Ceram (Seram)", "joloensis": "Jolo (Philippines)", "butonensis": "Buton (Indonesia)", "chaparensis": "Chapare (Bolivia)",
    "pamplonensis": "Pamplona (Colombia)", "manizalesensis": "Manizales (Colombia)", "meridensis": "Mérida (Venezuela)", "duidensis": "Cerro Duida (Venezuela)",
    "darienensis": "Darién (Panama)", "luzonensis": "Luzon (Philippines)", "tarmensis": "Tarma (Peru)", "beniensis": "Beni (Bolivia)",
    "andamanensis": "the Andaman Islands", "putumayensis": "the Putumayo", "paraensis": "Pará (Brazil)", "sangilensis": "San Gil (Colombia)",
    "gabonensis": "Gabon", "perijanensis": "the Sierra de Perijá", "marcosensis": "San Marcos Island (Mexico)", "batjanensis": "Batjan (Bacan) Island",
    "florensis": "Flores (Indonesia)", "hakkariensis": "Hakkari (Turkey)", "truongsonensis": "the Truong Son mountains (Vietnam)", "kermanensis": "Kerman (Iran)",
    "mabuensis": "Mount Mabu (Mozambique)", "alleghaniensis": "the Allegheny Mountains", "chocoensis": "the Chocó", "guangdongensis": "Guangdong (China)",
    "palawanensis": "Palawan (Philippines)", "dabieshanensis": "the Dabie Mountains (China)", "afarensis": "the Afar region", "indochinensis": "Indochina",
    "tamdaoensis": "Tam Dao (Vietnam)", "potosiensis": "San Luis Potosí (Mexico)", "kampucheaensis": "Kampuchea (Cambodia)", "cerradoensis": "the Cerrado (Brazil)",
    "merendonensis": "the Sierra del Merendón", "gialaiensis": "Gia Lai (Vietnam)", "banggaiensis": "the Banggai Islands", "pauloensis": "São Paulo (Brazil)",
    "poensis": "Fernando Pó (Bioko)", "timoriensis": "Timor", "liupanensis": "the Liupan Mountains (China)", "sichuanensis": "Sichuan (China)",
    "hoodensis": "Hood Island (Española, Galápagos)", "portoricensis": "Puerto Rico", "tulearensis": "Tuléar (Toliara, Madagascar)", "zoigeensis": "Zoigê (China)",
    "trungkhanhensis": "Trùng Khánh (Vietnam)", "cattienensis": "Cát Tiên (Vietnam)", "condaoensis": "Côn Đảo (Vietnam)", "gujaratensis": "Gujarat (India)",
    "monensis": "Mona Island", "ladacensis": "Ladakh", "antillensis": "the Antilles", "phuketensis": "Phuket (Thailand)", "carajasensis": "Carajás (Brazil)",
    "mossoroensis": "Mossoró (Brazil)", "pahangensis": "Pahang (Malaysia)", "kimberleyensis": "the Kimberley (Australia)", "biminiensis": "Bimini (Bahamas)",
    "canlaonensis": "Mount Canlaon (Philippines)", "guadeloupensis": "Guadeloupe", "culaochamensis": "Cù Lao Chàm (Vietnam)", "jobiensis": "Jobi (Yapen) Island",
    "salweenensis": "the Salween River", "admiraltiensis": "the Admiralty Islands", "andasibensis": "Andasibe (Madagascar)", "sindhensis": "Sindh (Pakistan)",
    "lankaensis": "Sri Lanka", "trangensis": "Trang (Thailand)", "shenzhenensis": "Shenzhen (China)", "enganensis": "Enggano Island (Indonesia)",
    "angelensis": "Ángel de la Guarda Island (Mexico)", "lorenzoensis": "San Lorenzo Island (Mexico)", "eriwanensis": "Erivan (Yerevan, Armenia)",
    "cerrejonensis": "Cerrejón (Colombia)", "naracoortensis": "Naracoorte (Australia)", "riversleighensis": "Riversleigh (Australia)", "pilbarensis": "the Pilbara (Australia)",
    "rondoensis": "the Rondo Plateau (Tanzania)", "jinggangensis": "Jinggangshan (China)", "mangshanensis": "Mangshan (China)", "kuatunensis": "Kuatun (China)",
    "lungshenensis": "Longsheng (China)", "futsingensis": "Futsing (Fuqing, China)", "maolanensis": "Maolan (China)", "potwarensis": "the Potwar Plateau (Pakistan)",
    "huerfanoensis": "Huerfano County (Colorado)", "herrlingensis": "Herrlingen (Germany)", "gyarosensis": "Gyaros Island (Greece)", "katiensis": "Kati (Mali)",
    "toritensis": "Torit (South Sudan)", "kunuaensis": "Kunua (Bougainville)", "texiguatensis": "Texíguat (Honduras)", "catamayensis": "Catamayo (Ecuador)",
    "tamaensis": "Tamá (on the Colombia-Venezuela border)", "betaniensis": "Betania (Colombia)", "gambotensis": "Gambote (Colombia)", "mahfalensis": "Mahafaly (Madagascar)",
    "marahuaquensis": "Cerro Marahuaca (Venezuela)", "giandinhensis": "Gia Định (Vietnam)", "giadinhensis": "Gia Định (Vietnam)", "jabrensis": "Pico do Jabre (Brazil)",
    "muriciensis": "Murici (Brazil)", "pisdurensis": "Pisdura (India)", "camfieldensis": "Camfield (Australia)", "yampiensis": "Yampi (Australia)",
    "iarakaensis": "Iaraka (Madagascar)", "ankafinaensis": "Ankafina (Madagascar)", "mbeerensis": "Mbeere (Kenya)", "sibauensis": "the Sibau River (Borneo)",
    "koshunensis": "Koshun (Hengchun, Taiwan)", "wynaudense": "Wynaad (Wayanad, India)", "engkariensis": "Engkari (Sarawak)", "corocoroensis": "Corocoro (Venezuela)",
    "ngansonensis": "Ngân Sơn (Vietnam)", "damingensis": "Damingshan (China)", "cupinensis": None, "lasgalenensis": None,
    "papuensis": "Papua (New Guinea)", "philippensis": "the Philippines", "philippinensis": "the Philippines", "caymanensis": "the Cayman Islands",
    "seychellensis": "the Seychelles", "comorensis": "the Comoros", "laoensis": "Laos", "cameronensis": "the Cameron Highlands (Malaysia)",
    "petlalcalensis": "Petlalcala (Mexico)",
}
# honorees: epithet -> (name, who they were, or "")  - only well-known people, checked by hand
HONOREES = {
    "guentheri": ("Albert Günther", "a German-born British zoologist at the British Museum"), "guentherii": ("Albert Günther", "a German-born British zoologist at the British Museum"),
    "albertguentheri": ("Albert Günther", "a German-born British zoologist at the British Museum"),
    "boulengeri": ("George Albert Boulenger", "a Belgian-British zoologist who described hundreds of reptiles"), "boulengerii": ("George Albert Boulenger", "a Belgian-British zoologist who described hundreds of reptiles"),
    "dunni": ("Emmett Reid Dunn", "an American herpetologist"), "stejnegeri": ("Leonhard Stejneger", "a Norwegian-American zoologist"),
    "slevini": ("Joseph Slevin", "an American herpetologist"), "barbouri": ("Thomas Barbour", "an American herpetologist"),
    "bocourti": ("Marie Firmin Bocourt", "a French zoologist"), "godmani": ("Frederick DuCane Godman", "a British naturalist"),
    "brazili": ("Vital Brazil", "a Brazilian doctor who made the first snake antivenoms in Brazil"), "battersbyi": ("James Battersby", "a British herpetologist"),
    "nattereri": ("Johann Natterer", "an Austrian naturalist who explored Brazil"), "zweifeli": ("Richard Zweifel", "an American herpetologist"),
    "slowinskii": ("Joseph Slowinski", "an American herpetologist"), "neuwiedi": ("Prince Maximilian of Wied-Neuwied", "a German naturalist and explorer"),
    "neuwiedii": ("Prince Maximilian of Wied-Neuwied", "a German naturalist and explorer"), "wiedii": ("Prince Maximilian of Wied-Neuwied", "a German naturalist and explorer"),
    "branchi": ("Bill Branch", "a South African herpetologist"), "doriae": ("Giacomo Doria", "an Italian naturalist"),
    "alcalai": ("Angel Alcala", "a Filipino biologist"), "ingeri": ("Robert Inger", "an American herpetologist"),
    "brongersmai": ("Leo Brongersma", "a Dutch herpetologist"), "broadleyi": ("Donald Broadley", "a herpetologist from Zimbabwe"),
    "schlegelii": ("Hermann Schlegel", "a German zoologist"), "schlegeli": ("Hermann Schlegel", "a German zoologist"),
    "mertensi": ("Robert Mertens", "a German herpetologist"), "robertmertensi": ("Robert Mertens", "a German herpetologist"),
    "ruthveni": ("Alexander Ruthven", "an American zoologist"), "mcdowelli": ("Samuel McDowell", "an American herpetologist"),
    "bairdi": ("Spencer Fullerton Baird", "an American naturalist"), "eiselti": ("Josef Eiselt", "an Austrian herpetologist"),
    "jani": ("Giorgio Jan", "an Italian zoologist"), "janii": ("Giorgio Jan", "an Italian zoologist"),
    "bogerti": ("Charles Bogert", "an American herpetologist"), "beddomei": ("Richard Beddome", "a British army officer and naturalist in India"),
    "beddomii": ("Richard Beddome", "a British army officer and naturalist in India"), "copei": ("Edward Drinker Cope", "an American palaeontologist and herpetologist"),
    "loveridgei": ("Arthur Loveridge", "a British herpetologist who worked in East Africa"), "hobartsmithi": ("Hobart Smith", "an American herpetologist"),
    "rouxestevae": ("Rolande Roux-Estève", "a French herpetologist"), "chirioi": ("Laurent Chirio", "a French herpetologist"),
    "whitakeri": ("Romulus Whitaker", "a herpetologist in India"), "romulusi": ("Romulus Whitaker", "a herpetologist in India"),
    "jerdoni": ("Thomas Jerdon", "a British naturalist in India"), "jerdonii": ("Thomas Jerdon", "a British naturalist in India"),
    "wagleri": ("Johann Georg Wagler", "a German herpetologist"), "stoliczkae": ("Ferdinand Stoliczka", "a Czech naturalist in India"),
    "bibroni": ("Gabriel Bibron", "a French zoologist"), "bibronii": ("Gabriel Bibron", "a French zoologist"),
    "steindachneri": ("Franz Steindachner", "an Austrian zoologist"), "fitzingeri": ("Leopold Fitzinger", "an Austrian zoologist"),
    "spixii": ("Johann Baptist von Spix", "a German naturalist who explored Brazil"), "sieboldii": ("Philipp Franz von Siebold", "a German doctor and naturalist in Japan"),
    "sieboldi": ("Philipp Franz von Siebold", "a German doctor and naturalist in Japan"), "blanfordi": ("William Thomas Blanford", "a British geologist and naturalist"),
    "blanfordii": ("William Thomas Blanford", "a British geologist and naturalist"), "linnaei": ("Carl Linnaeus", "the Swedish scientist who started the system of scientific names"),
    "darwini": ("Charles Darwin", "the English naturalist"), "plinii": None,
    "aesculapii": ("Aesculapius", "the Roman god of medicine, whose staff has a snake around it"),
    "mictlantecuhtli": ("Mictlantecuhtli", "the Aztec god of the dead"), "tlaloci": ("Tlaloc", "the Aztec god of rain"),
    "atahuallpae": ("Atahualpa", "the last emperor of the Inca"), "catesbyi": ("Mark Catesby", "an English naturalist"),
    "holbrooki": ("John Edwards Holbrook", "an American zoologist, often called the father of North American herpetology"),
    "kirtlandii": ("Jared Potter Kirtland", "an American naturalist"), "blandingii": ("William Blanding", "an American naturalist"),
    "couperi": ("James Hamilton Couper", "an American planter and naturalist"), "lecontei": ("John Lawrence LeConte", "an American naturalist"),
    "dekayi": ("James Ellsworth De Kay", "an American zoologist"), "sumichrasti": ("Francis Sumichrast", "a Swiss naturalist in Mexico"),
    "sallaei": ("Auguste Sallé", "a French naturalist"), "deppei": ("Ferdinand Deppe", "a German naturalist in Mexico"),
    "hammondii": ("William Hammond", "an American army surgeon and naturalist"), "couchii": ("Darius Couch", "an American army officer and naturalist"),
    "kennerlyi": ("Caleb Kennerly", "an American naturalist"), "emoryi": ("William Emory", "an American army officer and surveyor"),
    "lichtensteinii": ("Martin Lichtenstein", "a German zoologist"), "merremii": ("Blasius Merrem", "a German zoologist"),
    "boddaerti": ("Pieter Boddaert", "a Dutch naturalist"), "russelii": ("Patrick Russell", "a Scottish doctor who studied the snakes of India"),
    "hardwickii": ("Thomas Hardwicke", "a British army officer and naturalist in India"), "cantori": ("Theodore Cantor", "a Danish doctor and zoologist in India"),
    "cantoris": ("Theodore Cantor", "a Danish doctor and zoologist in India"),
    "hodgsoni": ("Brian Houghton Hodgson", "a British naturalist in Nepal"), "annandalei": ("Nelson Annandale", "a Scottish zoologist in India"),
    "macclellandi": ("John McClelland", "a British doctor and naturalist in India"), "oatesii": ("Eugene Oates", "a British naturalist in Burma"),
    "tytleri": ("Robert Tytler", "a British army officer and naturalist"), "blythii": ("Edward Blyth", "an English zoologist in India"),
    "theobaldi": ("William Theobald", "a British geologist and naturalist in India"), "swinhoei": ("Robert Swinhoe", "a British naturalist in China"),
    "styani": ("Frederick Styan", "a British tea merchant and naturalist in China"), "mouhoti": ("Henri Mouhot", "a French explorer of South-East Asia"),
    "schrenckii": ("Leopold von Schrenck", "a Russian zoologist"), "raddei": ("Gustav Radde", "a German naturalist in the Caucasus"),
    "latastei": ("Fernand Lataste", "a French zoologist"), "seoanei": ("Víctor López Seoane", "a Spanish naturalist"),
    "bedriagae": ("Jacques von Bedriaga", "a Russian herpetologist"), "darevskii": ("Ilya Darevsky", "a Russian herpetologist"),
    "nikolskii": ("Alexander Nikolsky", "a Russian zoologist"), "kaznakovi": ("Alexander Kaznakov", "a Russian explorer"),
    "dinniki": ("Nikolai Dinnik", "a Russian zoologist in the Caucasus"), "ursinii": ("Antonio Orsini", "an Italian naturalist"),
    "boettgeri": ("Oskar Boettger", "a German zoologist"), "peringueyi": ("Louis Péringuey", "a French-born South African naturalist"),
    "hoogmoedi": ("Marinus Hoogmoed", "a Dutch herpetologist"), "amarali": ("Afrânio do Amaral", "a Brazilian herpetologist"),
    "vanzolinii": ("Paulo Vanzolini", "a Brazilian zoologist (and songwriter)"), "schmidtleri": ("Schmidtler", ""),
    "werneri": ("Franz Werner", "an Austrian zoologist"), "bocagei": ("José Vicente Barbosa du Bocage", "a Portuguese zoologist"),
    "anchietae": ("José de Anchieta", "a Portuguese naturalist who explored Angola"), "duellmani": ("William Duellman", "an American herpetologist"),
    "kinghorni": ("James Roy Kinghorn", "an Australian herpetologist"), "krefftii": ("Gerard Krefft", "a German-Australian zoologist"),
    "gouldii": ("John Gould", "an English naturalist and bird artist"), "macleayi": ("William John Macleay", "an Australian naturalist"),
    "drummondhayi": ("Drummond-Hay", ""), "alphonsehogei": ("Alphonse Hoge", "a Brazilian herpetologist"),
    "thalesdelemai": ("Thales de Lema", "a Brazilian herpetologist"), "deschauenseei": ("Rodolphe Meyer de Schauensee", "an American naturalist"),
    "dorbignyi": ("Alcide d'Orbigny", "a French naturalist who explored South America"), "saintgironsi": ("Hubert Saint-Girons", "a French herpetologist"),
    "lasallei": None, "nicefori": ("Brother Nicéforo María", "a naturalist in Colombia"),
    "niceforoi": ("Brother Nicéforo María", "a naturalist in Colombia"), "dumerilii": ("Duméril", "the name of two French zoologists, André Duméril and his son Auguste"),
    "dumerili": ("Duméril", "the name of two French zoologists, André Duméril and his son Auguste"), "dumerilli": ("Duméril", "the name of two French zoologists, André Duméril and his son Auguste"),
    "zhaoermii": ("Zhao Ermi", "a Chinese herpetologist"), "liuchengchaoi": ("Liu Chengzhao", "a Chinese herpetologist"),
    "huangjietangi": ("Huang Jietang", ""), "ruuddelangi": ("Ruud de Lang", ""), "erangaviraji": ("Eranga Viraj", ""),
    "vonmayi": ("von May", ""), "rijgersmaei": ("Rijgersma", ""), "hungtai": None, "sansebastiani": None, "pachecogili": None, "guineai": None, "yangdatongi": ("Yang Datong", "a Chinese herpetologist"), "lipipengi": ("Li Pipeng", "a Chinese herpetologist"),
    "daovantieni": ("Đào Văn Tiến", "a Vietnamese zoologist"), "nguyenvansangi": ("Nguyễn Văn Sáng", "a Vietnamese herpetologist"),
    "ernstmayri": ("Ernst Mayr", "a German-American biologist"), "howardgloydi": ("Howard Gloyd", "an American herpetologist"),
    "karlschmidti": ("Karl Patterson Schmidt", "an American herpetologist"), "alfredschmidti": ("Alfred Schmidt", ""),
    "jamespetersi": ("James A. Peters", "an American herpetologist"), "fredparkeri": ("Fred Parker", ""), "vanwallachi": ("Van Wallach", "an American herpetologist"),
    "madgemintonae": ("Madge Minton", "an American herpetologist"), "mintoni": ("Minton", ""),
    "ericsmithi": ("Eric Smith", ""), "normanscotti": ("Norman Scott", ""), "pauldwyeri": ("Paul Dwyer", ""), "michaelsabini": ("Michael Sabin", ""),
    "ramonriveroi": ("Ramón Rivero", ""), "antoniogarciai": ("Antonio García", ""), "franciscopaivai": ("Francisco Paiva", ""), "rogerromani": ("Roger Roman", ""),
    "roshanpererai": ("Roshan Perera", ""), "katesandersae": ("Kate Sanders", "an Australian biologist"), "sharonbrooksae": ("Sharon Brooks", ""),
    "georgejetti": ("George Jett", ""), "bobridgelyi": ("Bob Ridgely", "an American ornithologist"), "bevridgelyi": ("Bev Ridgely", ""),
    "oswaldobaezi": ("Oswaldo Báez", ""), "nelsonjorgei": ("Nelson Jorge da Silva", "a Brazilian herpetologist"), "heliobelluomini": ("Hélio Belluomini", "a Brazilian herpetologist"),
    "josephscorteccii": ("Giuseppe Scortecci", "an Italian herpetologist"), "scortecci": ("Giuseppe Scortecci", "an Italian herpetologist"),
    "scorteccii": ("Giuseppe Scortecci", "an Italian herpetologist"), "peroescobari": ("Pero Escobar", ""), "mereljcoxi": ("Merel J. Cox", ""),
    "irmelindicaprioae": ("Irmelin DiCaprio", ""), "terrakarenorum": ("Terra and Karen", ""), "jamilinaisi": ("Jamili Nais", ""),
    "karinthandani": None, "rufiterminorum": None, "zoosvictoriae": ("Zoos Victoria", "the zoo group in Victoria, Australia"),
    "oneilli": ("O'Neill", ""), "osheai": ("Mark O'Shea", "a British herpetologist"), "desilvai": ("de Silva", ""),
    "hughesi": ("Hughes", ""), "mcgregori": ("McGregor", ""), "mcclungi": ("McClung", ""), "mcnamarae": ("McNamara", ""), "mcdougalli": ("McDougall", ""),
    "macdougalli": ("MacDougall", ""), "macdowelli": ("McDowell", ""), "macmahoni": ("MacMahon", ""), "mackinnoni": ("MacKinnon", ""), "macklotti": ("Macklot", ""),
    "muelleri": ("Müller", ""), "boehmei": ("Wolfgang Böhme", "a German herpetologist"), "koehleri": ("Köhler", ""), "doederleini": ("Döderlein", ""),
    "kuekenthali": ("Willy Kükenthal", "a German zoologist"), "buergersi": ("Bürgers", ""), "buegersi": ("Bürgers", ""), "froehlichi": ("Fröhlich", ""),
    "mlynarskii": ("Marian Młynarski", "a Polish palaeontologist"), "meszoelyi": ("Mészöly", ""), "guibei": ("Jean Guibé", "a French herpetologist"),
    "bornmuelleri": ("Bornmüller", ""), "schaeferi": ("Schäfer", ""), "fruhstorferi": ("Hans Fruhstorfer", "a German insect collector"),
    "mocquardi": ("François Mocquard", "a French zoologist"), "grandidieri": ("Alfred Grandidier", "a French naturalist who explored Madagascar"),
    "boiei": ("Friedrich Boie", "a German zoologist"), "hemprichii": ("Wilhelm Hemprich", "a German naturalist"),
    "schokari": None, "vibakari": None, "deserti": None, "paradisi": None, "exocoeti": None, "montecristi": None, "medici": None,
    "sinai": None, "captaini": None, "kuiburi": None, "sabahi": None, "koniagui": None, "tolaki": None, "kafubi": None, "sangi": None,
    "vulcani": None, "palmarum": None, "arenarum": None, "tenebrarum": None, "cariei": None, "ceii": None, "bai": None, "inopinae": None,
    "reginae": None, "pseudoreginae": None, "yavi": None, "bindi": None, "haadi": None, "quimi": None, "kundui": None, "kikoi": None, "beui": None,
    "lolo": None, "zawi": None, "cucae": None, "gaboi": None, "cairi": None, "tuani": None, "laui": None,
}
# also checked by hand: "-ae" names of women that are plain to read
HONOREES.update({k: (v, "") for k, v in {
    "marthae": "Martha", "emilyae": "Emily", "juliae": "Julia", "annae": "Anna", "mariae": "Maria", "helenae": "Helena", "andreae": "Andrea",
    "margaritae": "Margarita", "margaretae": "Margaret", "valeriae": "Valeria", "silviae": "Silvia", "rosaliae": "Rosalia", "joanae": "Joana",
    "matildae": "Matilda", "carlae": "Carla", "celiae": "Celia", "almae": "Alma", "marenae": "Marena", "marcellae": "Marcella", "teresitae": "Teresita",
    "elinorae": "Elinor", "herminae": "Hermina", "christineae": "Christine", "juliai": None, "camilae": "Camila", "dayanae": "Dayana",
    "lisyae": "Lisy", "graceae": None, "petronellae": "Petronella", "harriettae": "Harriett", "mariselae": "Marisela", "jodiae": "Jodie",
    "tracyae": "Tracy", "janaleeae": "Janalee", "maryellenae": "Mary Ellen", "juliescottae": "Julie Scott", "micheleae": "Michele",
    "gibsonae": None, "procterae": "Joan Procter", "phillipsae": None, "greyae": None, "thomasae": None, "gaigeae": "Helen Gaige",
}.items() if v})
HONOREES["procterae"] = ("Joan Procter", "a British herpetologist at the Natural History Museum and London Zoo")
HONOREES["gaigeae"] = ("Helen Gaige", "an American herpetologist")

# ---------------------------------------------------------------- helpers
def fold(t):
    return unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode().lower()

def _parse(word, finals_ok=True):
    """split a word into roots: [(form, meaning, lang, kind, pos)], fewest pieces; None if it doesn't split completely"""
    best = {0: []}
    n = len(word)
    for i in range(n):
        if i not in best: continue
        for j in range(i + 1, n + 1):
            piece = word[i:j]
            if j == n and piece in FIN:
                g, l, k = FIN[piece]
                cand = best[i] + [(piece, g, l, k, "fin")]
                if j not in best or len(cand) < len(best[j]): best[j] = cand
            if j < n and piece in PRE:
                g, l, k = PRE[piece]
                cand = best[i] + [(piece, g, l, k, "pre")]
                if j not in best or len(cand) < len(best[j]): best[j] = cand
    r = best.get(n)
    return r if r and len(r) >= 2 and r[-1][4] == "fin" else None

def _phrase(parts):
    mods, fin = parts[:-1], parts[-1]
    g, k = fin[1], fin[3]
    mg = [m[1] for m in mods]
    if any(m[3] == "p" for m in mods):
        body = [m[1] for m in mods if m[3] == "p"]; rest = [m[1] for m in mods if m[3] != "p"]
        if k == "a": return "with a %s %s" % ("-".join(rest + [g]), " ".join(body))
        if k == "c": return "with a %s %s" % (g, " ".join(body))
        return None
    if k == "n":
        if any(m[3] == "n" for m in mods):  # "two bands", but not "many belly"
            if g == "band": return "%s bands" % " ".join(mg)
            if g in ("scales", "lines", "teeth"): return "%s %s" % (" ".join(mg), g)
            return None
        return "%s %s" % (" ".join(mg), g)
    if k == "a" and any(m[3] == "t" for m in mods): return " and ".join(mg + [g])
    if k == "a": return "%s-%s" % ("-".join(mg), g)
    if k == "c": return " and ".join(mg + [g])
    if k == "d":
        if g in ("-shaped", "-like"): return "%s%s" % (" ".join(mg), g)
        return "%s %s" % (g, " ".join(mg))
    return None

def _lang(parts):
    ls = {p[2] for p in parts}
    return "Latin" if ls == {"L"} else "Greek" if ls == {"G"} else "Latin and Greek"

def _pieces(parts):
    return " + ".join(("%s- &lsquo;%s&rsquo;" % (p[0], p[1])) if p[4] == "pre" else ("-%s &lsquo;%s&rsquo;" % (p[0], p[1])) for p in parts)

def _cap(stem):
    s = stem[:1].upper() + stem[1:]
    if s.startswith("Mc") and len(s) > 3: s = "Mc" + s[2].upper() + s[3:]
    return s

def _place_from_range(stem, places):
    st = fold(stem)
    for p in places:
        q = re.sub(r"^[A-Z]{2}:", "", p); fq = re.sub(r"[^a-z]", "", fold(re.sub(r"\(.*?\)", "", q)))
        if len(st) >= 4 and len(fq) >= 4 and (fq.startswith(st) or (st.startswith(fq) and len(st) - len(fq) <= 1)):
            return re.sub(r"\s*\(\d+\)$", "", q)
    return None

def epithet(word, places=(), common=""):
    """(kind, html) for a species epithet, or None. kind: describes / place / person / name"""
    w = word.lower()
    if w in HONOREES:
        h = HONOREES[w]
        if not h: return None
        return ("person", "named after %s%s" % (h[0], (", " + h[1]) if h[1] else ""))
    if w in PLACE_WORDS:
        p = PLACE_WORDS[w]
        return ("place", "&lsquo;of %s&rsquo; &ndash; named after where it lives" % p) if p else None
    if w in PLACES:
        p = PLACES[w]
        return ("place", "&lsquo;from %s&rsquo; (the ending <i>-ensis</i> means &lsquo;from&rsquo; a place)" % p) if p else None
    if w in WORDS:
        return ("describes", "&lsquo;%s&rsquo;" % WORDS[w])
    if re.search(r"ensis$|ense$", w):
        stem = re.sub(r"(?:i?ensis|i?ense)$", "", w)
        p = _place_from_range(stem, places) or _place_from_range(re.sub(r"(ensis|ense)$", "", w), places)
        if p: return ("place", "&lsquo;from %s&rsquo; (the ending <i>-ensis</i> means &lsquo;from&rsquo; a place)" % p)
        return ("place", "named after the place where it was found (the ending <i>-ensis</i> means &lsquo;from&rsquo; a place)")
    parts = _parse(w)
    if parts:
        ph = _phrase(parts)
        if ph: return ("describes", "&lsquo;%s&rsquo;, from %s roots: %s" % (ph, _lang(parts), _pieces(parts)))
    # people: plain -i / -ii ("of Amaral"); a single surname only
    if w.endswith(("i", "ae")):
        stems = [w[:-2], w[:-1]] if w.endswith(("ii", "ae")) else [w[:-1]]
        if not 3 <= len(stems[0]) <= 12: return None
        for pn in possessives(common or ""):  # "Amaral's Tropical Racer": the person's own spelling
            fpn = re.sub(r"[^a-z]", "", fold(pn))
            for st in stems:
                if fpn.startswith(re.sub(r"[^a-z]", "", fold(st))) and len(fpn) - len(st) <= 1:
                    h = _famous(pn)
                    return ("person", "named after %s" % ("%s, %s" % h if h and fold(h[0].split()[-1]) == fold(pn) else "a person called %s" % pn))
        if w.endswith("ae"): return None  # women, or names ending in -a: not clear enough without the common name
        if w.endswith("ii"):  # Schlegel+ii or Tschudi+i: the name itself is not clear
            return ("person", "named after a person (the ending <i>-ii</i> means &lsquo;of&rsquo; someone)")
        return ("person", "named after a person called %s" % _cap(stems[0]))
    return None

# ---------------------------------------------------------------- genus
GEN_FIN = {"ophis": "snake", "odon": "tooth", "urus": "tail", "rhynchus": "snout", "notus": "back", "aspis": "asp",
           "lepis": "scale", "cephalus": "head", "calamus": "reed"}
GEN_PRE = {"lepto": "slender", "lept": "slender", "micr": "small", "micro": "small", "macro": "large", "olig": "few", "oligo": "few",
           "poly": "many", "xeno": "strange", "xen": "strange", "dendro": "tree", "dendr": "tree", "hydro": "water", "hydr": "water",
           "psamm": "sand", "psammo": "sand", "chrys": "golden", "chryso": "golden", "leio": "smooth", "lio": "smooth", "trachy": "rough",
           "platy": "flat", "rhino": "nose", "rhin": "nose", "thamn": "bush", "lyc": "wolf", "calli": "beautiful", "brachy": "short",
           "phyllo": "leaf", "panther": "panther", "tropid": "keel", "tropido": "keel", "hypsi": "high", "acanth": "thorn",
           "adel": "hidden", "als": "grove", "argyr": "silver", "australo": ("southern", "L"), "cerc": "tail", "cheil": "lip",
           "cylindr": "cylinder", "diad": "diadem", "dolich": "long", "ge": "earth", "gigant": "giant", "helminth": "worm",
           "hel": "marsh", "hemer": "day", "hetero": "different", "hier": "sacred", "hoplo": "armed", "lampr": "shiny",
           "limn": "lake", "lith": "stone", "meiz": "bigger", "palae": "ancient", "plectr": "spur", "scolec": "worm",
           "sibyn": "spear", "tetra": "four", "therm": "heat", "tom": "cutting", "typhl": "blind", "xyl": "wood", "din": "terrible",
           "crypt": "hidden", "eo": "dawn", "euprepi": "good-looking", "comps": "elegant", "calam": "reed", "ogm": "furrow"}
def genus(g):
    """a genus name that splits into two known roots: 'wolf tooth', or None"""
    w = g.lower()
    for fn, fg in GEN_FIN.items():
        if w.endswith(fn) and len(w) > len(fn) + 1:
            pre = w[:-len(fn)]
            if pre in GEN_PRE:
                pg, pl = GEN_PRE[pre] if isinstance(GEN_PRE[pre], tuple) else (GEN_PRE[pre], "G")
                if pg in ("few", "many", "four"): fg = {"tooth": "teeth", "scale": "scales"}.get(fg, fg)
                return "&lsquo;%s %s&rsquo;, from the %s roots %s- &lsquo;%s&rsquo; + -%s &lsquo;%s&rsquo;" % (
                    pg, fg, "Greek" if pl == "G" else "Latin and Greek", pre, pg, fn, fg)
    return None

# ---------------------------------------------------------------- common names
SNAKE_WORDS = {  # the snake word at the end of a name -> what it says
    "racer": "a name for fast-moving snakes", "keelback": "its scales have a ridge (a keel) along the middle",
    "kukri snake": "its curved back teeth are shaped like a kukri, a Nepalese knife", "wolf snake": "it has long fang-like front teeth, like a wolf",
    "cat snake": "its eyes have upright slit pupils, like a cat's", "cat-eyed snake": "its eyes have upright slit pupils, like a cat's",
    "garter snake": "its stripes look like the stripes on old-fashioned sock garters",
    "kingsnake": "it eats other snakes, even venomous ones", "ratsnake": "it eats rats and other rodents", "rat snake": "it eats rats and other rodents",
    "whipsnake": "it is long and thin, like a whip", "whip snake": "it is long and thin, like a whip", "hognose": "its upturned snout looks like a pig's",
    "hognose snake": "its upturned snout looks like a pig's", "lancehead": "its head is shaped like the point of a lance",
    "bronzeback": "it has a bronze-coloured back", "shieldtail": "its tail ends in a big, shield-like scale",
    "file snake": "its rough, baggy skin feels like a file (the metal tool)", "pitviper": "it has a heat-sensing pit on each side of its head, between the eye and the nostril",
    "pit viper": "it has a heat-sensing pit on each side of its head, between the eye and the nostril", "rattlesnake": "it shakes the rattle at the tip of its tail",
    "cobra": "from the Portuguese <i>cobra de capelo</i>, &lsquo;hooded snake&rsquo;", "mamba": "from <i>imamba</i>, its name in the Zulu language",
    "python": "after Python, the giant serpent of Greek myth", "boa": "from <i>boa</i>, a Latin word for a large snake",
    "viper": "from the Latin <i>vipera</i>, &lsquo;bearing live young&rsquo; - most vipers give birth instead of laying eggs",
    "adder": "from the Old English <i>n&aelig;dre</i>, &lsquo;snake&rsquo; (&lsquo;a nadder&rsquo; became &lsquo;an adder&rsquo;)",
    "asp": "from the Greek <i>aspis</i>, an old name for a venomous snake", "burrowing asp": "it burrows, and is venomous (asp is an old word for a venomous snake)",
    "sipo": "from the Portuguese <i>cip&oacute;</i>, a jungle vine", "copperhead": "its head is copper-coloured",
    "fer-de-lance": "French for &lsquo;iron of a lance&rsquo; (a spearhead), for the shape of its head", "milksnake": "after an old myth that it drank milk from cows",
    "milk snake": "after an old myth that it drank milk from cows", "egg eater": "it eats birds' eggs", "egg-eater": "it eats birds' eggs",
    "snail eater": "it eats snails", "snail-eater": "it eats snails", "snail sucker": "it pulls snails out of their shells", "slug eater": "it eats slugs",
    "slug-eater": "it eats slugs", "slug snake": "it eats slugs and snails", "centipede snake": "it eats centipedes", "centipede eater": "it eats centipedes",
    "centipede-eater": "it eats centipedes", "lizard eater": "it eats lizards", "frog eater": "it eats frogs", "crayfish snake": "it eats crayfish",
    "snake eater": "it eats other snakes", "snake-eater": "it eats other snakes", "coffee snake": "it is often found in coffee plantations",
    "night snake": "it is active at night", "lyre snake": "it has a lyre-shaped mark on its head", "patchnose snake": "it has a large patch-like scale on its snout",
    "hooknose snake": "its snout is turned up like a hook", "leafnose snake": "it has a leaf-shaped scale on its snout",
    "shovel-snout": "its snout is shaped like a shovel, for digging", "shovelnose snake": "its snout is shaped like a shovel, for digging",
    "spitting cobra": "it can spit venom at the eyes of an attacker", "death adder": "a very venomous snake that looks like an adder",
    "puff adder": "it puffs itself up and hisses when disturbed", "horned viper": "it has horn-like scales above its eyes",
    "eyelash viper": "it has eyelash-like scales above its eyes", "vine snake": "it is very thin and green or brown, like a vine",
    "parrot snake": "it is bright green, like a parrot", "mole viper": "it burrows underground, like a mole", "pipe snake": "its body is round like a pipe",
    "cylinder snake": "its body is round like a cylinder", "sunbeam snake": "its shiny scales flash rainbow colours in the sun",
    "indigo snake": "its glossy blue-black colour", "gopher snake": "it eats gophers and other rodents", "pine snake": "it lives in pine forests",
    "ringneck snake": "it has a coloured ring around its neck", "ring-necked snake": "it has a coloured ring around its neck",
    "diadem snake": "the crown-like pattern on its head", "flying snake": "it can glide from tree to tree", "tiger snake": "its bands look like a tiger's stripes",
    "carpet python": "its pattern looks like a carpet", "carpet viper": "its pattern looks like a carpet", "skaapsteker": "Afrikaans for &lsquo;sheep stabber&rsquo;",
    "blind snake": "its eyes are tiny and covered by scales, so it can hardly see", "blindsnake": "its eyes are tiny and covered by scales, so it can hardly see",
    "worm snake": "it is small and looks like a worm", "thread snake": "it is as thin as a thread", "threadsnake": "it is as thin as a thread",
    "earth snake": "it burrows in the soil", "reed snake": "it is thin, like a reed", "sea snake": "it lives in the sea", "seasnake": "it lives in the sea",
    "sea krait": "a krait-like snake that lives in the sea", "water snake": "it lives in or near water", "watersnake": "it lives in or near water",
    "tree snake": "it lives in trees", "treesnake": "it lives in trees", "ground snake": "it lives on or under the ground", "groundsnake": "it lives on or under the ground",
    "sand boa": "a boa that burrows in sand", "sand snake": "it lives in sandy places", "mud snake": "it lives in muddy, wet places",
    "litter snake": "it lives in the leaf litter on the forest floor", "bush viper": "a viper that climbs in bushes and trees",
    "tree boa": "a boa that lives in trees", "dwarf boa": "a small kind of boa", "burrowing snake": "it burrows underground",
    "house snake": "it is often found near houses", "forest racer": "a fast-moving snake of forests", 
}
SIMPLE = {  # single describing words
    "black": "its colour", "brown": "its colour", "green": "its colour", "red": "its colour", "yellow": "its colour", "white": "its colour",
    "olive": "its colour", "grey": "its colour", "gray": "its colour", "orange": "its colour", "golden": "its colour", "purple": "its colour",
    "blue": "its colour", "dusky": "its dark colour", "pale": "its pale colour", "rufous": "its reddish-brown colour", "scarlet": "its bright red colour",
    "emerald": "its bright green colour", "copper": "its copper colour", "plumbeous": "its lead-grey colour", "silver": "its colour", "indigo": "its blue-black colour", "dark": "its dark colour",
    "striped": "its stripes", "spotted": "its spots", "banded": "its bands", "ringed": "its rings", "speckled": "its speckles", "barred": "its bars",
    "blotched": "its blotches", "collared": "the collar on its neck", "crowned": "the crown-like mark on its head", "lined": "its lines",
    "variegated": "its patchy pattern", "reticulated": "its net-like pattern", "reticulate": "its net-like pattern", "ocellated": "its eye-spots",
    "painted": "its colourful pattern", "ornate": "its decorated pattern", "elegant": "its elegant look", "graceful": "its slim shape",
    "slender": "its slim body", "gracile": "its slim body", "stout": "its thick body", "smooth": "its smooth scales", "keeled": "its keeled (ridged) scales",
    "rough": "its rough scales", "plain": "its plain colours", "variable": "its colours vary a lot", "dwarf": "it is small", "pygmy": "it is very small",
    "giant": "it is very big", "large": "its size", "small": "its size", "little": "its size", "big": "its size", "great": "its size",
    "beaked": "its beak-like snout", "horned": "its horn-like scales", "hooded": "its hood", "burrowing": "it burrows",
    "tropical": "it lives in the tropics", "montane": "it lives in mountains", "mountain": "it lives in mountains", "forest": "it lives in forests",
    "desert": "it lives in deserts", "island": "it lives on an island", "coastal": "it lives near the coast", "swamp": "it lives in swamps",
    "marsh": "it lives in marshes", "stream": "it lives by streams", "brook": "it lives by brooks", "river": "it lives by rivers", "mangrove": "it lives in mangroves",
    "bamboo": "it lives among bamboo", "palm": "it lives in palm trees", "grass": "it lives in grass", "rock": "it lives among rocks",
    "woodland": "it lives in woodland", "meadow": "it lives in meadows", "highland": "it lives in highlands", "plains": "it lives on the plains",
    "western": "where it lives (in the west)", "eastern": "where it lives (in the east)", "northern": "where it lives (in the north)",
    "southern": "where it lives (in the south)", "central": "where it lives (in the middle of a region)",
    "asp": "from the Greek <i>aspis</i>, an old name for a venomous snake",
    "common": "it is the commonest or best-known of its kind", "false": "it looks like one, but isn't",
}
PARTS = {"headed": "head", "bellied": "belly", "tailed": "tail", "eyed": "eyes", "scaled": "scales", "lipped": "lips", "necked": "neck",
         "naped": "nape", "nosed": "nose", "snouted": "snout", "backed": "back", "sided": "sides", "throated": "throat", "chinned": "chin",
         "fanged": "fangs", "toothed": "teeth", "lined": "lines", "striped": "stripes", "banded": "bands", "spotted": "spots", "ringed": "rings",
         "collared": "collar", "blotched": "blotches", "marked": "markings", "crowned": "crown", "glossed": "sheen", "faced": "face", "jawed": "jaw"}
PLACE_ADJ = {"mexican": "Mexico", "african": "Africa", "american": "America", "chinese": "China", "brazilian": "Brazil", "asian": "Asia",
             "malayan": "Malaya", "philippine": "the Philippines", "indian": "India", "ethiopian": "Ethiopia", "colombian": "Colombia",
             "papuan": "Papua", "cuban": "Cuba", "bolivian": "Bolivia", "sumatran": "Sumatra", "somali": "Somalia", "jamaican": "Jamaica",
             "angolan": "Angola", "arabian": "Arabia", "egyptian": "Egypt", "bornean": "Borneo", "burmese": "Burma (Myanmar)", "japanese": "Japan",
             "haitian": "Haiti", "andean": "the Andes", "oaxacan": "Oaxaca", "guerreran": "Guerrero", "sonoran": "the Sonoran Desert",
             "chocoan": "the Chocó", "neotropical": "the Neotropics (Central and South America)", "oriental": "the Orient (Asia)",
             "pacific": "the Pacific", "rican": None, "peruvian": "Peru", "venezuelan": "Venezuela", "australian": "Australia",
             "madagascan": "Madagascar", "malagasy": "Madagascar", "european": "Europe", "persian": "Persia (Iran)", "caucasian": "the Caucasus",
             "javan": "Java", "ceylonese": "Ceylon (Sri Lanka)", "taiwanese": "Taiwan", "vietnamese": "Vietnam", "thai": "Thailand",
             "ecuadorian": "Ecuador", "guatemalan": "Guatemala", "honduran": "Honduras", "panamanian": "Panama", "argentine": "Argentina",
             "chilean": "Chile", "uruguayan": "Uruguay", "paraguayan": "Paraguay", "texas": "Texas", "florida": "Florida", "california": "California",
             "sri lankan": "Sri Lanka", "lankan": None, "nepalese": "Nepal", "himalayan": "the Himalayas", "tibetan": "Tibet", "sinhalese": "Sri Lanka",
             "namib": "the Namib Desert", "kenyan": "Kenya", "tanzanian": "Tanzania", "cameroonian": "Cameroon", "congolese": "the Congo",
             "moroccan": "Morocco", "algerian": "Algeria", "iranian": "Iran", "turkish": "Turkey", "greek": "Greece", "balkan": "the Balkans",
             "iberian": "Iberia", "italian": "Italy", "spanish": "Spain", "portuguese": "Portugal", "sardinian": "Sardinia", "sicilian": "Sicily",
             "corsican": "Corsica", "cretan": "Crete", "cypriot": "Cyprus", "bahamian": "the Bahamas", "hispaniolan": "Hispaniola",
             "caribbean": "the Caribbean", "amazonian": "the Amazon", "patagonian": "Patagonia", "chacoan": "the Chaco", "yucatan": "the Yucatán"}

REGION_ADJ = {"central american": "Central America", "south american": "South America", "north american": "North America",
              "west african": "West Africa", "east african": "East Africa", "south african": "South Africa", "central african": "Central Africa",
              "southeast asian": "South-East Asia", "south asian": "South Asia", "sri lankan": "Sri Lanka", "costa rican": "Costa Rica",
              "puerto rican": "Puerto Rico", "new guinea": "New Guinea", "sri lanka": "Sri Lanka"}

def _plain(t): return re.sub(r"<[^>]+>", "", t)

ADJ_OK = set("""black white red yellow green brown blue grey gray orange golden olive pink purple dark pale bright
small large big long short broad narrow flat sharp pointed blunt keeled rough smooth thin thick two three four many
spotted striped banded white-lipped""".split())
POSS = re.compile(r"^(.+?)(?:'s|’s|'|’)$")

def _famous(surname):
    """a well-known person in HONOREES with exactly this surname"""
    hits = {h for h in HONOREES.values() if h and h[1] and fold(h[0].split()[-1]) == fold(surname)}
    return hits.pop() if len(hits) == 1 else None

def possessives(name):
    return [m.group(1) for m in (POSS.match(t) for t in name.split()) if m]

def common_name(name, epi=None, epi_info=None, places=()):
    """[(part of the name, what it says)] for a common name, or None"""
    toks = name.split()
    out, used = [], set()
    sw = None  # the snake word: the longest known ending
    for n in (3, 2, 1):
        if len(toks) >= n:
            cand = " ".join(toks[-n:]).lower()
            if cand in SNAKE_WORDS and SNAKE_WORDS[cand]:
                sw = (" ".join(toks[-n:]), SNAKE_WORDS[cand]); used.update(range(len(toks) - n, len(toks))); break
    fp = {fold(re.sub(r"\s*\(\d+\)$", "", re.sub(r"^[A-Z]{2}:", "", p))).strip() for p in places}
    i = 0
    while i < len(toks):
        if i in used: i += 1; continue
        t = toks[i]; tl = t.lower().strip(",")
        m = POSS.match(t)
        if m:
            person = m.group(1); who = None
            if epi_info and epi_info[0] == "person" and fold(person) in fold(_plain(epi_info[1])):
                who = _plain(epi_info[1]).replace("named after ", "")
            elif _famous(person):
                h = _famous(person); who = "%s, %s" % h
            out.append((t, "named after %s" % (who or "a person called %s" % person))); i += 1; continue
        # a place in the snake's own range, one to three words long (Saint Lucia, Kerala...)
        hit = None
        for n in (3, 2, 1):
            js = [x for x in range(i, i + n) if x not in used]
            if len(js) == n and i + n <= len(toks) and t[:1].isupper():
                j = fold(" ".join(toks[i:i + n]))
                if len(j) >= 4 and j in fp: hit = n; break
        if hit:
            out.append((" ".join(toks[i:i + hit]), "the place where it lives")); i += hit; continue
        two = (tl + " " + toks[i + 1].lower()) if i + 1 < len(toks) and i + 1 not in used else ""
        if two in REGION_ADJ:
            pl = REGION_ADJ[two]
            out.append((" ".join(toks[i:i + 2]), ("it lives in %s" if fold(pl) in fp else "after %s") % pl)); i += 2; continue
        if "-" in tl:
            a, _, b = tl.partition("-")
            if b in PARTS and a in ADJ_OK: out.append((t, "for its %s %s" % (a, PARTS[b])))
            i += 1; continue
        if tl in PLACE_ADJ and PLACE_ADJ[tl]:
            pl = PLACE_ADJ[tl]
            inr = fold(pl.split(" (")[0]).replace("the ", "") in fp
            out.append((t, ("it lives in %s" if inr else "after %s") % pl)); i += 1; continue
        if tl in SIMPLE: out.append((t, SIMPLE[tl]))
        i += 1
    if sw: out.append(sw)
    return out or None

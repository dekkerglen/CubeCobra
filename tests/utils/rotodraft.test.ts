import { parseRotoCSV } from "../../src/util/rotodraft";

const MOCK_ROTO = `,,Rotisserie Draft,,Next Pick: ,Ian M,,,,,,,,,,,,,,,,,,
,,,, ,,,,,,,,,,,,,,,,,,,
,,David ,Ben,◈  Ian M  ◈,Ian C,Alex,Clayton,,,,,,,,,,,,,,,,
1,→,Survival of the Fittest,Underworld Breach,Animate Dead,Sensei's Divining Top,Agatha's Soul Cauldron,Aluren,,,↩, ,,,Draft Status,,,,G,R,B,C,C,G
2,↪,"Titania, Protector of Argoth",Brain Freeze,Recurring Nightmare,Basalt Monolith,Walking Ballista,Enlightened Tutor,,,,,,,Double Picks After:,25,,,G,U,B,C,C,W
3,,Baloth Prime,Displacer Kitten,Vampiric Tutor,Thassa's Oracle,Mox Opal,Glimpse of Nature,,,↩,,,,Players:,6,,,G,U,B,U,C,G
4,↪,Misty Rainforest,Mystical Tutor,Archfiend of Ifnir,Forensic Gadgeteer,Goblin Welder,Green Sun's Zenith,,,,,,,Picks per Player:,45,,,C,U,B,U,R,G
5,,Wooded Foothills,More or Less,Entomb,Brainstone,Windswept Heath,Lunarch Veteran,,,↩,,,,Total Picks:,270,,,C,U,B,C,C,W
6,↪,Verdant Catacombs,Gitaxian Probe,Raucous Theater,Brainstorm,Arid Mesa,Molten Gatekeeper,,,,,,,Picks Made:,81,,,C,U,BR,U,C,R
7,,Flooded Strand,Scalding Tarn,Bloodstained Mire,Polluted Delta,Marsh Flats,Earthcraft,,,↩,,,,Picks Remaining:,189,,,C,C,C,C,C,G
8,↪,Spara's Headquarters,Dig Through Time,Oliphaunt,Lórien Revealed,Raugrin Triome,Worldly Tutor,,,,,,,Making Double Picks:,FALSE,,,WUG,U,R,U,WUR,G
9,,Jetmir's Garden,Intuition,Troll of Khazad-dûm,Lotus Bloom,Ziatora's Proving Ground,"Heliod, Sun-Crowned",,,↩,,,,Next Player if Single Pick:,3,,,WRG,U,B,C,BRG,W
10,↪,Ketria Triome,Mizzix's Mastery,Faithless Looting,Shark Typhoon,Intruder Alarm,Hangarback Walker,,,,,,,Next Player if Double Pick,5,,,URG,R,R,U,U,C
11,,Malevolent Rumble,Magma Opus,Stitcher's Supplier,Mishra's Bauble,Phyrexian Metamorph,Enduring Renewal,,,↩,,,,Round Number:,13,,,G,UR,B,C,U,W
12,↪,Elvish Reclaimer,Consider,Nihil Spellbomb,Meticulous Archive,Dismember,Kor Skyfisher,,,,,,,Next Player:,3,,,G,U,B,WU,B,W
13,,Aftermath Analyst,How to Keep an Izzet Mage Busy,Shadowgrange Archfiend,"Emry, Lurker of the Loch",Devoted Druid,Eternal Witness,,,↩,,,,Next Row:,13,,,G,UR,B,U,G,G
14,↪,,,,Urza's Bauble,Savai Triome,Gilded Goose,,,,,,,Next Player Name:,Ian M,,,,,,C,WBR,G
15,,,,,,,,,,↩,,,,Draft Active:,TRUE,,,,,,,,
16,↪,,,,,,,,,,,,,,,,,,,,,,
17,,,,,,,,,,↩,,,,,,,,,,,,,
18,↪,,,,,,,,,,,,,,,,,,,,,,
19,,,,,,,,,,↩,,,,,,,,,,,,,
20,↪,,,,,,,,,,,,,,,,,,,,,,
21,,,,,,,,,,↩,,,,,,,,,,,,,
22,↪,,,,,,,,,,,,,,,,,,,,,,
23,,,,,,,,,,↩,,,,,,,,,,,,,
24,↪,,,,,,,,,,,,,,,,,,,,,,
25,,,,,,,,,,↩,,,,,,,,,,,,,
26,↪,,,,,,,,,,,,,,,,,,,,,,
27,,,,,,,,,,,,,,,,,,,,,,,
28,,,,,,,,,,↩,,,,,,,,,,,,,
29,,,,,,,,,,,,,,,,,,,,,,,
30,↪,,,,,,,,,,,,,,,,,,,,,,
31,,,,,,,,,,,,,,,,,,,,,,,
32,,,,,,,,,,↩,,,,,,,,,,,,,
33,,,,,,,,,,,,,,,,,,,,,,,
34,↪,,,,,,,,,,,,,,,,,,,,,,
35,,,,,,,,,,,,,,,,,,,,,,,
36,,,,,,,,,,↩,,,,,,,,,,,,,
37,,,,,,,,,,,,,,,,,,,,,,,
38,↪,,,,,,,,,,,,,,,,,,,,,,
39,,,,,,,,,,,,,,,,,,,,,,,
40,,,,,,,,,,↩,,,,,,,,,,,,,
41,,,,,,,,,,,,,,,,,,,,,,,
42,↪,,,,,,,,,,,,,,,,,,,,,,
43,,,,,,,,,,,,,,,,,,,,,,,
44,,,,,,,,,,✪,,,,,,,,,,,,,
45,,,,,,,,,,,,,,,,,,,,,,,`;

describe('parseRotoCSV', () => {
  it('works', () => {
    const { picks } = parseRotoCSV(MOCK_ROTO);

    expect(picks["Survival of the Fittest"]).toMatchObject({
      cardName: "Survival of the Fittest",
      overallPickNumber: 1,
      playerPickNumber: 1,
      playerIndex: 2
    });
  })
})
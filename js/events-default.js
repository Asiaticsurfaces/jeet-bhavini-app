// The wedding schedule the app starts with. The family panel's Events tab copies
// these into the database once; after that the database version is used.
window.DEFAULT_EVENTS=[
 {id:'mameru',day:'1',name:'Mameru',gu:'મામેરું',tag:'Where Blessings Begin',start:'2026-12-01T09:00:00+05:30',hrs:3,time:'9:00 AM',venue:'Oleander Ballroom',img:'assets/user_mameru_final.png',dress:'Pastel traditional',note:'Hosted by Mr. Devendra Keshavlal Bhadani & family.',
  pack:['Pastel traditional outfit','Light shawl, mornings are cool in December','Comfortable footwear'],
  rites:[['Mameru','The maternal uncle (mama) and his family arrive with gifts of clothes, jewellery and sweets, and bless the family before the wedding.']]},
 {id:'sangeet',day:'1',name:'Sangeet',gu:'સંગીત',tag:'An Evening of Song & Dance',start:'2026-12-01T19:00:00+05:30',hrs:4,time:'7:00 PM',venue:'Oleander Lawn',img:'assets/user_sangeet_final.png',dress:'Glam Indo-western',note:'Performances, dhol and an open dance floor. Add your song requests in Guest Info.',
  pack:['Glam Indo-western outfit','Flat shoes or block heels, it\'s on the lawn','Shawl or jacket, Karjat nights get cold','Phone charged for the wedding camera'],
  rites:[['Sangeet','An evening of music and dance. Both families perform for the couple, then the dance floor opens for everyone.']]},
 {id:'mandap',day:'2',name:'Mandap Ropan',gu:'મંડપ રોપણ',tag:'Raising the Sacred Canopy',start:'2026-12-02T08:00:00+05:30',hrs:2,time:'8:00 AM',venue:'Oleander Ballroom',img:'assets/user_mandap_clean.png',dress:'Yellows & greens',note:'A morning puja to raise the mandap.',
  pack:['Yellow or green outfit','Head covering for the puja (optional)','Water bottle'],
  rites:[['Ganesh Sthapana','A prayer to Lord Ganesha so the wedding goes smoothly.'],['Mandap Ropan','The family plants the first pillar of the wedding canopy (mandap) with a small puja.']]},
 {id:'wedding',day:'2',name:'Wedding',gu:'લગ્ન',tag:'The Joining of Hands',start:'2026-12-02T15:30:00+05:30',hrs:5,time:'3:30 PM onwards',venue:'Oleander Lake Side',img:'assets/user_lagna_scene_final.png',dress:'Traditional, reds & golds',moments:[['3:30 PM','Jaan Prastan'],['5:41 PM','Hastamelap']],note:'Please be seated by 5:15 PM for the Hastamelap.',
  pack:['Traditional outfit in reds or golds','Comfortable footwear for the Jaan (lots of dancing)','Sunglasses for the afternoon','Shawl for the evening by the lake'],
  rites:[['Jaan Prastan','The groom\'s procession arrives with dhol and dancing. The bride\'s mother welcomes him at the entrance.'],['Varmala','The couple exchange flower garlands.'],['Hastamelap','The bride\'s hand is placed in the groom\'s. This is the moment they are joined, at 5:41 PM.'],['Mangal Fera','The couple walk around the sacred fire, taking their wedding vows.'],['Kansar','The couple feed each other a sweet, their first meal together.']]},
];

// "What to wear" card for each event (the family panel can change any of it per event).
// t = dress code, s = style, her / him = ideas, c = colour palette, bg / ink = card colours, outfit = couple illustration.
window.DRESS_DEFAULTS={
 sufi:{t:'Ivory Nights',s:'Elegant ethnic',her:'Ivory or white anarkali, sharara or saree',him:'White kurta with a Nehru jacket',c:['#fffaf0','#efe6d2','#d8c3a5','#e8c4c4'],bg:'#f4efe4',ink:'#6b5530'},
 mameru:{t:'Pastel Perfection',s:'Traditional',her:'Pastel saree or lehenga',him:'Pastel kurta or Nehru jacket',c:['#f4c6d0','#bfe3d0','#c8d8f0','#e0cdee'],bg:'#f8e6ea',ink:'#7a2f4a'},
 sangeet:{t:'Glitz & Glam',s:'Indo-western',her:'Sequinned lehenga, gown or drape saree',him:'Bandhgala, Indo-western or tuxedo kurta',c:['#2d1b4e','#7a2848','#c0c0c8','#c9a54a'],bg:'#e9e3f2',ink:'#4b2a6b'},
 mandap:{t:'Sunshine & Marigold',s:'Traditional',her:'Yellow or green saree, or a kurta set',him:'Yellow kurta with white pajama',c:['#f2c230','#f08a24','#6a9a3a','#fff4d6'],bg:'#fbf0cf',ink:'#7a5410'},
 wedding:{t:'Royal Indian Splendour',s:'Traditional, reds & golds',her:'Lehenga or Gujarati saree in red, maroon or gold',him:'Sherwani or bandhgala, safa for the Jaan',c:['#9b1b2a','#5e1f3a','#c9a54a','#f4e3c1'],bg:'#f6e3e6',ink:'#7a1f2b'},
};
window.dressOf=e=>e.dc&&e.dc.t?e.dc:window.DRESS_DEFAULTS[e.of||e.id]||(/sufi/i.test(e.name||'')?window.DRESS_DEFAULTS.sufi:null)
  ||(e.dress?{t:e.dress,s:'',her:'',him:'',c:[],bg:'#f3ead6',ink:'#5e1f3a'}:null);

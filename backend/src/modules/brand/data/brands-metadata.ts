export interface BrandMetadataRecord {
  name: string;
  slug: string;
  aliases: string[];
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
  h1: string;
  description: string;
  faqs: Array<{ question: string; answer: string }>;
  productCount?: number;
  logo?: string;
  menuGroup?: string;
}

export const BRANDS_METADATA: BrandMetadataRecord[] = [
  // 1. Axor Helmets
  {
    name: "Axor Helmets",
    slug: "axor-helmets",
    aliases: ["axor", "axor-helmet", "axorhelmets"],
    metaTitle: "Axor Helmets- Official Axor Helmet Range, Prices & Models | Store4Riders",
    metaDescription: "Shop genuine Axor helmets- from commuter to full-face sport designs. Compare Axor helmet price, view Axor black helmet options, and get fitment guidance, warranty details, and fast dispatch.",
    metaKeywords: "Biker helmets, riding jacket, biker gloves, motorcycle helmet, riding boots, axor helmets, axor helmet price",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/axor-logo_bw_100x51.png",
    h1: "Axor Helmets",
    productCount: 50,
    description: `<p><strong>Ride safer. Ride smarter. Ride Axor.</strong> Discover the Axor helmets collection built for everyday riders and performance seekers alike. Axor blends modern safety features, comfortable fit, and bold styling so you can ride with confidence. Whether you want a lightweight commuter lid, a ventilated full-face, or a sleek Axor black helmet, find authentic Axor options and transparent Axor helmet price information right here.</p>
<p><strong>Why choose Axor helmets</strong></p>
<ul>
<li><strong>Certified protection</strong> — helmets engineered to meet safety standards for reliable impact protection.</li>
<li><strong>Comfort-first fit</strong> — multi-density liners, removable pads, and ergonomic shell shapes for long-ride comfort.</li>
<li><strong>Style and finish</strong> — classic matte and gloss <strong>Axor black helmet</strong> finishes plus graphic options.</li>
<li><strong>Clear pricing</strong> — compare <strong>Axor helmet price</strong> across models and sizes to match budget and needs.</li>
<li><strong>Genuine parts &amp; warranty</strong> — buy authentic Axor helmets with manufacturer support and spare parts availability.</li>
</ul>`,
    faqs: [
      {
        question: "What makes Axor helmets a good choice?",
        answer: "Axor helmets combine practical safety features, comfortable fit systems, and contemporary styling at competitive Axor helmet price points. They're designed for daily commuters and recreational riders who want dependable protection without premium-brand markup.",
      },
      {
        question: "Do Axor helmets come in black?",
        answer: "Yes. The range includes popular Axor black helmet finishes in both matte and gloss, plus graphic and two-tone options to suit different tastes.",
      },
      {
        question: "How do I choose the right Axor helmet size?",
        answer: "Measure your head circumference at the widest point above the eyebrows. Match that measurement to the size chart on the product page. If you're between sizes, choose the smaller size for a snug fit or the larger for comfort; use our helmet fitment guide for exact recommendations.",
      },
      {
        question: "Are Axor helmets certified?",
        answer: "All Axor models meet recognized safety standards (e.g., ISI, DOT, ECE). Check each product page for the specific certification and test marks.",
      },
      {
        question: "What is the typical Axor helmet price range?",
        answer: "Axor helmet price varies by model, features, and finish. Entry-level commuter helmets are priced competitively, while full-face and feature-rich models sit higher. See individual product pages for current pricing and promotions.",
      },
      {
        question: "Can I replace parts like visors and liners?",
        answer: "Yes. Genuine Axor spare parts such as visors, inner liners, and cheek pads are available for many models.",
      },
      {
        question: "How do I care for my Axor helmet?",
        answer: "Clean the shell with mild soap and a soft cloth. Remove and wash liners per manufacturer instructions. Avoid strong solvents and prolonged sun exposure to preserve finish and safety materials.",
      },
      {
        question: "How much warranty is available on Axor helmets?",
        answer: "Axor helmets come with 1 year warranty against manufacturing defects.",
      },
    ],
  },

  // 2. SMK Helmets
  {
    name: "SMK Helmets",
    slug: "smk-helmets",
    aliases: ["smk", "smk-helmet", "smkhelmets"],
    metaTitle: "SMK Helmets India | Buy SMK Helmets Online – Price from ₹3,990",
    metaDescription: "Shop 100% genuine SMK helmets online in India. SMK helmets price starts at ₹3,990. ISI/ECE certified, free shipping, COD & EMI available.",
    metaKeywords: "smk helmets price, smk helmets, smk helmet, smk helmets india",
    logo: "/brands/smk.svg",
    h1: "SMK Helmets",
    productCount: 62,
    description: `<p><strong>European styling meets world-class manufacturing.</strong> SMK is a premier helmet brand combining Italian design finesse with Studds' four decades of manufacturing expertise. Conceptualized in Europe and engineered in India, SMK helmets provide modern safety features, superior aerodynamics, and bold styling so you can ride with confidence.</p>
<p>Store4Riders brings you 100% genuine SMK helmets with manufacturer warranty, transparent pricing starting at ₹3,990, free shipping across India, and convenient COD and EMI payment options.</p>
<p><strong>Key Highlights:</strong></p>
<ul>
<li><strong>100% Genuine Helmets:</strong> Sourced directly from authorized distributors.</li>
<li><strong>Certified Protection:</strong> Multi-density EPS shells meeting ISI, ECE 22.05/22.06, and DOT standards.</li>
<li><strong>Italian-Inspired Design:</strong> Aerodynamic shell contours, channeled ventilation, and optical visors.</li>
<li><strong>Value Pricing:</strong> Prices starting at ₹3,990 with free shipping across India.</li>
<li><strong>Flexible Payments:</strong> Cash on Delivery and easy EMI options available at checkout.</li>
<li><strong>1-Year Warranty:</strong> Full manufacturer coverage against production defects.</li>
</ul>
<h3>The SMK Helmet Range</h3>
<p>Explore the full SMK lineup engineered for every riding style: the versatile <strong>Twister</strong> and lightweight <strong>Stellar</strong> for urban commuting, the high-performance <strong>Titan</strong> carbon-composite sport helmets, the feature-rich <strong>Gullwing Modular</strong> for highway touring, and the race-inspired <strong>Typhoon</strong>, <strong>Nova</strong>, and <strong>Agnar</strong> series.</p>`,
    faqs: [
      {
        question: "Are SMK helmets good for daily use in India?",
        answer: "Yes. SMK helmets are designed with multi-channel ventilation, washable hypoallergenic comfort liners, and scratch-resistant visors, making them ideal for Indian traffic and weather conditions while meeting ISI and ECE safety standards.",
      },
      {
        question: "What is the price range of SMK helmets?",
        answer: "SMK helmets start at ₹3,990 for entry-level models and range up to ₹10,000+ for advanced modular, dual-visor, and composite carbon editions.",
      },
      {
        question: "Who manufactures SMK helmets?",
        answer: "SMK helmets are conceptualized and designed in Italy by European designers and manufactured by Studds Accessories Ltd., the world's largest helmet manufacturer by volume.",
      },
      {
        question: "Are SMK helmets ISI, ECE or DOT certified?",
        answer: "Yes. Depending on the model, SMK helmets carry ISI (IS 4151:2015), European ECE (22.05 / 22.06), and US DOT certifications.",
      },
      {
        question: "Is Store4Riders an authorized seller of SMK helmets?",
        answer: "Yes, Store4Riders is an authorized retailer offering 100% genuine SMK helmets with factory warranty, valid GST invoice, and hassle-free size exchanges.",
      },
      {
        question: "Is there a warranty on SMK helmets?",
        answer: "SMK helmets come with a 1-year manufacturer warranty covering manufacturing defects.",
      },
      {
        question: "Which SMK model is best for highway touring?",
        answer: "For highway touring, the SMK Gullwing Modular helmet provides the flip-up convenience and dual visor sun shield, while the SMK Titan and Typhoon offer superior high-speed aerodynamic stability and wind-noise reduction.",
      },
    ],
  },

  // 3. Rynox Gear
  {
    name: "Rynox Gear",
    slug: "rynox-gear",
    aliases: ["rynox-gears", "rynox"],
    metaTitle: "Rynox Gear India: Rynox Jackets, Gloves & Riding Luggage | Store4Riders",
    metaDescription: "Explore genuine Rynox riding gear in India. Shop CE-certified Rynox jackets, gloves, tank bags, saddlebags, and H2Go waterproof rain gear designed for Indian roads with fast dispatch and EMI.",
    metaKeywords: "Biker helmets, riding jacket, biker gloves, motorcycle helmet, riding boots, rynox gear, rynox jackets, rynox gloves",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/new-rynox-logo-black.png",
    h1: "Rynox Gear",
    productCount: 46,
    description: `<p><strong>Engineered for Indian roads and weather.</strong> Rynox Gear is India's leading motorcycle protective apparel brand, designing high-performance riding gear specifically for Indian climate extremes—from high-temperature summers and heavy monsoon rains to rugged mountain passes.</p>
<p>Store4Riders curates authentic Rynox riding jackets, motorcycle gloves, adventure pants, and touring luggage with official warranty and fast shipping across India.</p>
<p><strong>Why Choose Rynox Gear:</strong></p>
<ul>
<li><strong>CE-Certified Armor:</strong> Flagship jackets and pants feature Knox and Safe-Tech CE Level 2 protectors.</li>
<li><strong>Engineered Ventilation:</strong> Heavy-duty 3D mesh panels optimized for maximum airflow in Indian summers.</li>
<li><strong>Monsoon Ready:</strong> Proprietary H2Go 100% waterproof rain systems keep you dry in downpours.</li>
<li><strong>Durable Construction:</strong> Abrasion-resistant Cordura textiles and heavy-duty stitching throughout.</li>
</ul>
<h3>Rynox Collections</h3>
<p><strong>GT Series:</strong> High-airflow mesh jackets like the Air GT and Urban GT, ideal for daily city commuting.</p>
<p><strong>Pro Series:</strong> Flagship touring gear such as the Stealth Evo and Advento Pro, built for long-distance highway expeditions.</p>
<p><strong>Riding Luggage:</strong> Navigator tank bags, Drystack saddlebags, and tail bags featuring 100% waterproof construction.</p>`,
    faqs: [
      {
        question: "Is Rynox an Indian brand?",
        answer: "Yes, Rynox Gear was founded and is headquartered in Mumbai, India, with products designed specifically for Indian terrain, weather, and ergonomics.",
      },
      {
        question: "What is Rynox best known for?",
        answer: "Rynox is best known for pioneering CE Level 2 certified motorcycle jackets (like the Air GT and Stealth Evo), high-durability gloves, and its proprietary H2Go 100% waterproof rain systems.",
      },
      {
        question: "City riding vs touring: which Rynox series should I pick?",
        answer: "For city riding, choose the GT series (such as Air GT) for superior airflow and lightweight agility. For long-distance touring, choose the Pro series (such as Stealth Evo) for comprehensive armor, thermal liners, and touring storage.",
      },
      {
        question: "Is Rynox gear fully waterproof?",
        answer: "Specialized rain products like the H2Go Pro series and Drystack luggage are 100% waterproof. Rynox all-weather jackets include dedicated internal or external H2Go waterproof liners that keep you dry in heavy rains while allowing breathability.",
      },
      {
        question: "What warranty comes with Rynox products?",
        answer: "Rynox products carry a manufacturer warranty against craftsmanship and material defects, typically 6 months to 1 year depending on the product line.",
      },
    ],
  },

  // 4. Rolon
  {
    name: "Rolon",
    slug: "rolon",
    aliases: ["rolon-chain-sprocket-kits", "rolon-sprockets"],
    metaTitle: "Rolon Chain Sprocket Kits Online | Best Price - Store4Riders",
    metaDescription: "Buy 100% genuine Rolon chain sprocket kits for your bike at the best price. Direct OEM fitment, brass and noise-free variants for 130+ motorcycle models with fast delivery across India.",
    metaKeywords: "Biker helmets, riding jacket, biker gloves, motorcycle helmet, riding boots, rolon chain sprocket, rolon brass chain",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/rolon.jpg",
    h1: "Rolon",
    productCount: 64,
    description: `<h2>Rolon Chain Sprocket Kits: Genuine OEM Fitment and Price Promise</h2>
<p>Store4Riders sells only genuine Rolon chain and sprocket kits, manufactured by L.G. Balakrishnan &amp; Bros Ltd (LGB)—the primary OEM supplier to major Indian motorcycle makers including Royal Enfield, Bajaj, TVS, Yamaha, and Honda.</p>
<ul>
<li><strong>100% Genuine Kits:</strong> Sourced directly from authorized LGB channels—guaranteed authentic, no counterfeits.</li>
<li><strong>OEM-Grade Fitment:</strong> Matches factory-fitted parts to exact dimensional specifications.</li>
<li><strong>130+ Models Covered:</strong> Dedicated sprocket kits for commuter, cruiser, and performance motorcycles.</li>
<li><strong>Competitive Pricing:</strong> Direct wholesale-tier prices with transparent invoice billing.</li>
<li><strong>Premium Variants:</strong> High-durability Brass coated and low-noise sealed O-ring/X-ring chains.</li>
<li><strong>Fast Shipping:</strong> Express tracked delivery across all pincodes in India.</li>
<li><strong>Care Products:</strong> Rolon chain lube and cleaning sprays for routine drive maintenance.</li>
</ul>
<h3>Why Buy Rolon</h3>
<p>LGB's advanced heat-treatment technology ensures high tensile strength, minimal chain stretch, and long-lasting durability even in dusty, wet Indian road conditions.</p>
<h3>Choosing the Right Kit</h3>
<p>Rolon kits range from commuter bikes to high-performance street machines, offering standard, heavy-duty, brass, and noise-free variants where available.</p>`,
    faqs: [
      {
        question: "What is a Rolon chain sprocket kit?",
        answer: "A complete replacement kit including a front engine sprocket, rear wheel sprocket, and matched high-tensile chain for direct bolt-on installation.",
      },
      {
        question: "Is Rolon genuine for Indian motorcycles?",
        answer: "Yes. Rolon is the major original equipment manufacturer (OEM) supplier for most Indian motorcycle brands.",
      },
      {
        question: "What does a Rolon kit cost?",
        answer: "Prices typically range from ₹1,200 to ₹3,500+ depending on the motorcycle model and chain variant (standard vs brass O-ring).",
      },
      {
        question: "Standard vs. brass kits?",
        answer: "Brass kits feature an electroplated gold brass coating that provides enhanced corrosion resistance and a premium appearance.",
      },
      {
        question: "How do I find the right kit?",
        answer: "Use the motorcycle model filter on Store4Riders to match your exact make, model, and engine variant.",
      },
      {
        question: "How long does a kit last?",
        answer: "Typically 15,000 to 25,000 km or more with regular cleaning and lubrication every 500-700 km.",
      },
      {
        question: "What is included?",
        answer: "Each box includes one front sprocket, one rear sprocket, and one pre-sized chain with a master link.",
      },
      {
        question: "Should dampers be replaced?",
        answer: "Yes, we recommend replacing rear wheel rubber hub dampers along with the new kit to ensure smooth operation.",
      },
      {
        question: "Is there a warranty?",
        answer: "All Rolon kits sold by Store4Riders are genuine OEM products backed by LGB's quality assurance.",
      },
      {
        question: "Are care products sold?",
        answer: "Yes, chain cleaners, lubricants, and cleaning brushes are available.",
      },
    ],
  },

  // 5. Royal Enfield
  {
    name: "Royal Enfield",
    slug: "royal-enfield",
    aliases: ["royal-enfield-helmet-riding-gear", "re", "royal-enfield-gear"],
    metaTitle: "Buy Genuine Royal Enfield Riding gear and helmets online",
    metaDescription: "Shop genuine Royal Enfield helmets, riding jackets, gloves, pants, and boots delivered across India, with fast shipping and EMI at checkout.",
    metaKeywords: "royal enfield helmet price, royal enfield helmet half face, royal enfield open face helmet, royal enfield riding gear",
    logo: "/brands/royal-enfield.svg",
    h1: "Royal Enfield",
    productCount: 20,
    description: `<h2>Royal Enfield</h2>
<p>Royal Enfield's story began with its first motorcycle in 1901. The brand's guiding idea is <strong>"Made Like a Gun,"</strong> describing simple, durable, dependable machines. Store4Riders brings genuine Royal Enfield helmets, protective riding apparel, and motorcycle accessories to riders across India.</p>
<p>From retro open-face and full-face helmets crafted to complement iconic Classic, Bullet, and Meteor cruisers, to CE-armored touring jackets, gloves, riding shoes, and waterproof luggage, Royal Enfield gear delivers comfort and heritage on every ride.</p>
<h3>Warranty</h3>
<ul>
<li><strong>Riding gear:</strong> 6 months from the invoice date.</li>
<li><strong>Lifestyle apparel and accessories:</strong> 3 months from the retail invoice date.</li>
</ul>
<p>Warranty claim procedure: <a href="https://store.royalenfield.com/policy-on-returns-exchanges" target="_blank" rel="noopener noreferrer">Royal Enfield returns and exchanges policy</a>.</p>`,
    faqs: [
      {
        question: "Are Royal Enfield products on Store4Riders genuine?",
        answer: "Yes, all Royal Enfield gear and helmets on Store4Riders are 100% genuine with authentic tags and manufacturer warranty.",
      },
      {
        question: "What is the warranty period for Royal Enfield apparel?",
        answer: "Riding gear is covered for 6 months from the invoice date, and lifestyle apparel/accessories for 3 months against manufacturing defects.",
      },
      {
        question: "Which helmets suit Classic 350 and Bullet motorcycles?",
        answer: "Royal Enfield's open-face and classic full-face helmets with retro graphics and leather-trimmed liners are specially styled to match classic and cruiser motorcycles.",
      },
    ],
  },

  // 6. Clan shoes
  {
    name: "Clan shoes",
    slug: "clan-shoes",
    aliases: ["clan", "clan-shoe"],
    metaTitle: "Clan Shoes India | Waterproof Riding Boots with D3O | Store4Riders",
    metaDescription: "Shop Clan shoes online, waterproof riding boots built with D3O protection for everyday wear. Explore Scout, Torque, and Stealth ranges with fast delivery across India.",
    metaKeywords: "shoes, clan shoes, clan riding boots, waterproof motorcycle sneakers, d3o riding shoes",
    logo: "/brands/clan-shoes.svg",
    h1: "Clan shoes",
    productCount: 5,
    description: `<p>Riding boots often get left at home because they're bulky and uncomfortable for everyday use. Clan shoes are designed to look and feel like sneakers while still providing real protection.</p>
<p>Each pair has a DryTech waterproof membrane and D3O protection at the ankle, toe and heel on most models. The Stealth SNKR edition is CE certified.</p>
<p>Scout, Torque and Stealth are browsable by model:</p>
<ul>
<li><strong>Everyday wear:</strong> Sneaker styling with genuine riding protection.</li>
<li><strong>D3O protection:</strong> Ankle, toe and heel protection on most models, with a CE certified option.</li>
<li><strong>Waterproof variants:</strong> DryTech membrane for rain and wet commutes.</li>
<li><strong>Crash damage cover:</strong> One year of crash damage cover in addition to the standard warranty.</li>
</ul>
<h2>The Clan Range Explained</h2>
<p><strong>Scout:</strong> Entry-level model. Lightweight and flexible, with a D3O option and the same waterproof membrane as the rest of the range.</p>
<p><strong>Torque:</strong> Mid-range model, more structured matte tech build, D3O ankle armour, reinforced toe and heel protection for daily commuting and longer rides.</p>
<p><strong>Stealth:</strong> Premium model, coated leather. D3O or rigid TPU ankle protection depending on variant. SNKR Stealth Edition is CE certified.</p>
<p>Sizing follows EU sizes and runs true across the range. Most models come in men's, women's and unisex fits, depending on colourway.</p>`,
    faqs: [
      {
        question: "What is Clan shoes and how is it different from regular riding boots?",
        answer: "A riding footwear brand focused on protective gear comfortable enough to wear all day, using sneaker-style designs with D3O protection and a waterproof build.",
      },
      {
        question: "Are Clan shoes actually waterproof?",
        answer: "Waterproof models use a DryTech membrane that keeps water out while allowing the shoe to breathe.",
      },
      {
        question: "What does D3O protection mean on a Clan shoe?",
        answer: "D3O is a soft material that stiffens on impact, used at ankle, toe and heel on most models.",
      },
      {
        question: "Which Clan shoe should I buy: Scout, Torque or Stealth?",
        answer: "Scout is lightest and most affordable. Torque offers more structure for commuters and longer rides. Stealth is the premium leather option, with the SNKR edition CE certified.",
      },
      {
        question: "What happens if my Clan shoes get damaged in a fall?",
        answer: "One-year crash damage cover applies in addition to the regular warranty, subject to the brand's terms.",
      },
      {
        question: "How do Clan shoe sizes run?",
        answer: "EU sizing, generally true to size. Check the size chart if between sizes.",
      },
    ],
  },

  // 7. TVS Racing performance gear
  {
    name: "TVS Racing performance gear",
    slug: "tvs-racing-performance-gear",
    aliases: ["tvs-racing", "tvs-racing-gear", "tvs"],
    metaTitle: "Buy TVS Racing Performance Gear online | TVS Helmets | TVS Riding Jacket",
    metaDescription: "TVS Racing Performance Gear for enthusiast riders, quality products at budget-friendly prices. Range includes TVS helmets, XPOD helmets, riding jackets, and gloves.",
    metaKeywords: "tvs helmet, tvs riding jacket, xpod helmet, tvs riding gloves, tvs riding gear full set",
    logo: "/brands/tvs-racing.svg",
    h1: "TVS Racing performance gear",
    productCount: 25,
    description: `<p>TVS Motor Company is India's third-largest two-wheeler manufacturer, with annual sales above 3 million units and exports to more than 60 countries.</p>
<p>TVS Racing Performance Gear is built for enthusiast riders, offering quality products at budget-friendly prices. The range includes:</p>
<ul>
<li>TVS Helmets</li>
<li><a href="/products/tvs-xpod-helmets">TVS XPOD Helmets</a></li>
<li>TVS riding jackets</li>
<li>TVS racing helmets</li>
<li>TVS riding gloves</li>
<li>Balaclavas, jerseys, and accessories</li>
</ul>`,
    faqs: [
      {
        question: "What is TVS Racing Performance Gear?",
        answer: "The official riding gear division of TVS Motor Company, developing motorsport-tested helmets, jackets, and gloves with ISI and international certifications.",
      },
      {
        question: "Are TVS XPOD helmets certified?",
        answer: "Yes, TVS XPOD helmets meet Indian BIS (IS 4151:2015) safety requirements with optical Pinlock-ready visors.",
      },
      {
        question: "Does Store4Riders sell genuine TVS Racing gear?",
        answer: "Yes, 100% genuine products with manufacturer warranty and express shipping across India.",
      },
    ],
  },

  // 8. Raida Gears
  {
    name: "Raida Gears",
    slug: "raida-gears",
    aliases: ["raida", "raida-gear"],
    metaTitle: "Raida Gears | Raida Bike cover | Raida Riding Jacket| Raida Boots",
    metaDescription: "Shop riding gear by Raida Gears, \"Made in India\", bike covers, gloves, jackets, base layers, boots and pants with free shipping across India.",
    metaKeywords: "raida gears, raidagears, raida gear, raida riding gear, raida india, raida bag, raida riding pants, raida riding gears, bike cover, raida bike cover, waterproof bike cover, bike rain cover, raida riding jacket, raida boots",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/Raida.png",
    h1: "Raida Gears",
    productCount: 46,
    description: `<p>Raida Gears was founded in 2015 to supply quality riding products and accessories to Indian motorcycle riders. The brand works to match international quality standards and continually improves its products. It presents itself as "Made in India."</p>
<ul>
<li>Bike covers</li>
<li>Gloves</li>
<li>Jackets</li>
<li>Base layers</li>
<li>Boots</li>
<li>Pants</li>
</ul>
<p><strong>Warranty:</strong> Rainpro bike covers carry a 3-month warranty, SeasonPro bike covers carry a 12-month warranty, and all other products carry a 6-month warranty against manufacturing defects.</p>`,
    faqs: [
      {
        question: "Where are Raida products made?",
        answer: "Raida Gears is proudly conceived, engineered, and manufactured in India.",
      },
      {
        question: "What is the difference between RainPro and SeasonPro bike covers?",
        answer: "RainPro is an ultra-light waterproof cover (3-month warranty); SeasonPro is a heavy-duty, UV-resistant all-weather cover (12-month warranty).",
      },
      {
        question: "What warranty comes with Raida riding gear?",
        answer: "Riding jackets, gloves, boots, and pants carry a 6-month warranty against manufacturing defects.",
      },
    ],
  },

  // 9. BluArmor
  {
    name: "BluArmor",
    slug: "bluarmor",
    aliases: ["blu-armor", "bluearmor"],
    metaTitle: "BluArmor Helmet Communicators | BluArmor C30 | Store4Riders",
    metaDescription: "Shop BluArmor helmet intercom systems, including the BluArmor C30 with mesh connectivity for up to 20 riders. Built for two-wheeler riders with 1-year warranty.",
    metaKeywords: "Biker helmets, riding jacket, biker gloves, motorcycle helmet, riding boots, bluarmor, bluarmor c30",
    logo: "/brands/bluarmor.svg",
    h1: "BluArmor",
    productCount: 5,
    description: `<p>BluArmor makes helmet communicators for two-wheeler riders. The C30 is its most popular model and uses the RIDEGRID mesh intercom, which keeps a group connected as riders spread out, rather than relying on a direct Bluetooth link.</p>
<p><strong>Key Features:</strong></p>
<ul>
<li><strong>Mesh Connectivity:</strong> Connects up to 20 riders with automatic reconnection.</li>
<li><strong>Tuned Speakers:</strong> High-definition audio tuned for riding speeds with wind noise suppression.</li>
<li><strong>IP67 Water and Dust Rating:</strong> Built to withstand torrential Indian monsoons.</li>
<li><strong>Glove-Friendly Controls:</strong> 5-button interface easily operated with motorcycle gloves.</li>
<li><strong>Long Battery Life:</strong> Rated for up to 16 hours of continuous use with OTA firmware updates.</li>
</ul>`,
    faqs: [
      {
        question: "What is RIDEGRID mesh in BluArmor?",
        answer: "RIDEGRID is BluArmor's mesh intercom protocol connecting up to 20 riders with dynamic self-healing network connectivity.",
      },
      {
        question: "What is the range of BluArmor intercoms?",
        answer: "Approximately 1.1 km line-of-sight in open conditions between riders.",
      },
      {
        question: "Is BluArmor waterproof?",
        answer: "Yes, rated IP67 for water and dust resistance.",
      },
      {
        question: "How long does the battery last?",
        answer: "Approximately 16 hours of continuous intercom or music playback.",
      },
      {
        question: "What is the warranty on BluArmor devices?",
        answer: "BluArmor provides a 1-year warranty against manufacturing defects.",
      },
    ],
  },

  // 10. LS2 Helmets
  {
    name: "LS2 Helmets",
    slug: "ls2-helmets",
    aliases: ["ls2", "ls2-helmet", "ls2helmets"],
    metaTitle: "LS2 Helmets India | Buy LS2 Helmet Online - Store4Riders",
    metaDescription: "Shop genuine LS2 full-face helmets online, compare prices, sizes and colours, with EMI and COD options.",
    metaKeywords: "Biker helmets, riding jacket, biker gloves, motorcycle helmet, riding boots, ls2 helmets",
    logo: "/brands/ls2.svg",
    h1: "LS2 Helmets",
    productCount: 27,
    description: `<p>Founded in 2007, LS2 is a helmet brand backed by about three decades of manufacturing experience from its parent company, MHR. It is sold in over 125 countries.</p>
<p>LS2 helmets use a lightweight KPA shell. Ventilation, visor clarity and fit are designed with real-world riding in mind.</p>
<p>The store carries LS2's full-face touring and daily rider lines in several colourways. Products are genuine, come with manufacturer warranty, and ship free within India.</p>
<ul>
<li><strong>Full LS2 range:</strong> Complete full-face lineup, with colourway comparisons.</li>
<li><strong>Genuine and warranty backed:</strong> Manufacturer warranty against shell defects.</li>
<li><strong>Flexible payments:</strong> EMI and cash on delivery.</li>
<li><strong>Free shipping:</strong> Across India, with no extra shipping charge.</li>
</ul>
<h2>Explore the LS2 Range</h2>
<p>The <a href="/products/ls2-ff800-storm-ii">touring range</a> targets highway riders and includes a Pinlock-ready visor and drop-down sun shield.</p>
<p>The <a href="/products/ls2-ff320-stream-ii">daily rider range</a> is the more affordable full-face option. It carries ECE 22.06 and ISI certification, a SHARP 4-star rating, and Bluetooth intercom readiness.</p>`,
    faqs: [
      {
        question: "What is the price range of LS2 helmets in India?",
        answer: "Prices run from roughly ₹7,800 for the entry full-face range to about ₹11,800 for the touring range, depending on model and graphic finish.",
      },
      {
        question: "Is LS2 a good helmet brand?",
        answer: "LS2 has made helmets since 2007, is backed by MHR, and sells in over 125 countries. Several models have a SHARP 4-star rating.",
      },
      {
        question: "Are LS2 helmets ISI or BIS certified for use in India?",
        answer: "Yes. Models carry ECE 22.06 plus ISI or BIS 4151:2015 certification, depending on the model.",
      },
      {
        question: "Does Store4Riders offer EMI or COD on LS2 helmets?",
        answer: "Yes, both EMI and cash on delivery are available.",
      },
      {
        question: "What sizes do LS2 helmets come in?",
        answer: "Most models range from S to 3XL, though availability can vary by colourway. Check each product's size chart before ordering.",
      },
    ],
  },

  // 11. Falco
  {
    name: "Falco",
    slug: "falco",
    aliases: ["falco-boots"],
    metaTitle: "Buy Falco Boots in India @ Store4Riders.com | Falco boots",
    metaDescription: "Falco Riding Boots - Italian style with Value for Money pricing. Explore the range of Falco Riding boots in India.",
    metaKeywords: "falco riding boots, falco boots, falco motorcycle boots india, falco boots for sale, falco boots d3o, falco boots size chart, falco marshall boots, falco avantour 2, falco motorcycle boots review",
    logo: "https://www.store4riders.com/media/codazon_cache/brand/120x120/Background.png",
    h1: "Falco",
    productCount: 10,
    description: `<p>Starting from the company headquarter based in Cornuda (near Venice in Italy), in the cradle of a major sportswear industrial district Gianni Falco srl has reached a respected position among market leaders growing to a global brand presence. Falco Riding Boots are known to provide Italian style with Value for Money pricing.</p>
<p>6 month warranty against manufacturing defects on all Falco Boots. Explore the range of Falco boots in India here.</p>`,
    faqs: [
      {
        question: "Where are Falco boots made?",
        answer: "Falco is based in Cornuda (near Venice), Italy, delivering Italian styling with high safety standards.",
      },
      {
        question: "What warranty is provided on Falco boots?",
        answer: "Falco boots carry a 6-month warranty against manufacturing defects.",
      },
    ],
  },

  // 12. Forma Boots
  {
    name: "Forma Boots",
    slug: "forma-boots",
    aliases: ["forma-adventure-boots-india", "forma"],
    metaTitle: "Buy Forma Adventure Boots India | Forma Riding Boots | Forma Shoes",
    metaDescription: "Get the top quality Italian Forma riding boots. Forma adventure low boots, adventure high boots, Forma Ice Pro, Forma Freccia available. Free delivery across India. Only genuine products. EMI option available.",
    metaKeywords: "forma riding boots, forma motorcycle boots, forma adventure boots, forma boots, forma shoes, forma boots india, forma riding boots india, forma riding shoes, forma shoes india, forma adventure boots india",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/Forma.png",
    h1: "Forma Boots",
    productCount: 2,
    description: `<h3><strong>Forma Adventure Boots:</strong></h3>
<p>The Forma brand was born in 1999 in Italy and since then has always shown important growth trends.</p>
<p>Thanks to its own R&amp;D and the continuous technical development, Forma Shoes has been able to offer the market a complete product range. Only the highest quality standards have guaranteed Forma to become a global brand amongst the most recognized in the world.</p>
<p>Forma motorcycle boots are distributed in 70 countries worldwide and the entire collection is developed in Italy and produced exclusively in the European Community. The Forma brand is now recognized as one of the most innovative brands in the motorcycle boot business.</p>
<p>All of the Forma Boots range is CE approved EN 13634:2015 by the main Italian Testing and Research centre Ricotest. 6 month warranty against manufacturing defects.</p>
<p>Forma riding boots are eligible for free shipping across India.</p>`,
    faqs: [
      {
        question: "Where are Forma boots produced?",
        answer: "Designed in Italy and produced exclusively in the European Community.",
      },
      {
        question: "Are Forma boots CE approved?",
        answer: "Yes, CE approved under standard EN 13634:2015 by Ricotest in Italy.",
      },
      {
        question: "What warranty applies to Forma boots?",
        answer: "Forma boots include a 6-month warranty against manufacturing defects.",
      },
    ],
  },

  // 13. BMC Air Filter
  {
    name: "BMC Air Filter",
    slug: "bmc-air-filter",
    aliases: ["bmc-air-filter-for-bike", "bmc"],
    metaTitle: "BMC Air Filter for Bike | Genuine BMC Filters | Store4Riders",
    metaDescription: "Shop genuine BMC air filter options for your motorcycle. Washable and reusable performance air filters with cotton gauze construction and 2-year warranty.",
    metaKeywords: "Biker helmets, riding jacket, biker gloves, motorcycle helmet, riding boots, bmc air filter, bike air filter",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/BMC_Air_filter_logo.png",
    h1: "BMC Air Filter",
    productCount: 26,
    description: `<p>BMC has a motorsport background, supplying air filters to race teams before moving the same construction into road bike filters.</p>
<p>Each filter uses several layers of oil-treated cotton fabric held between two epoxy-coated aluminium mesh frames. This layered design improves airflow compared with a stock paper filter while still filtering effectively.</p>
<ul>
<li><strong>Race-proven construction:</strong> layered cotton between corrosion-resistant aluminium mesh.</li>
<li><strong>Washable and reusable:</strong> the filter can be cleaned and reinstalled for the life of the bike.</li>
<li><strong>Two-year warranty:</strong> covers production defects for two years from purchase.</li>
<li><strong>Model-specific fitment:</strong> filter by bike to find the matching airbox filter.</li>
</ul>
<h3>How a BMC Filter Is Built</h3>
<p>The cotton layers capture debris mainly by sieving and retention, so airflow is not significantly restricted. The aluminium frame keeps its shape under heat and vibration, and the epoxy coating resists fuel vapour and humidity. The higher build cost explains the price compared with a basic paper element.</p>`,
    faqs: [
      {
        question: "What is a BMC air filter made of?",
        answer: "Layers of oil-treated cotton fabric held between two epoxy-coated aluminium mesh frames, offering filtration with better airflow than standard paper.",
      },
      {
        question: "How much does a BMC air filter for bike cost?",
        answer: "Prices vary by model and generally sit above standard paper filters. Filter by your bike on the page to see the exact price.",
      },
      {
        question: "Is a BMC air filter washable and reusable?",
        answer: "Yes. It is designed to be cleaned and re-oiled rather than replaced, and the manufacturer states it can last the vehicle's service life with proper maintenance.",
      },
      {
        question: "What warranty comes with a BMC air filter?",
        answer: "A two-year warranty against production defects from the date of purchase.",
      },
      {
        question: "Will a BMC air filter fit my bike without modification?",
        answer: "Filters are designed to match the stock airbox of specific models and variants. Select the listing for your exact model and variant, and it should fit without trimming or modification.",
      },
    ],
  },

  // 14. K&N Bike Air Filter
  {
    name: "K&N Bike Air Filter",
    slug: "k-n-bike-air-filter",
    aliases: ["k&n-bike-air-filter", "kn-bike-air-filter", "k-and-n"],
    metaTitle: "K&N Air Filter for Bike | Genuine K&N Filters | Store4Riders",
    metaDescription: "Shop genuine K&N air filter options for your motorcycle. Washable, reusable high-flow air cleaners with Million Mile Limited Warranty.",
    metaKeywords: "Biker helmets, riding jacket, biker gloves, motorcycle helmet, riding boots, kn air filter, k&n bike filter",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/K_N-Logo.png",
    h1: "K&N Bike Air Filter",
    productCount: 12,
    description: `<p>K&amp;N Engineering is an industry pioneer with over 50 years of filtration innovation. K&amp;N performance motorcycle filters use oiled, layered cotton gauze rather than restrictive disposable paper elements.</p>
<ul>
<li><strong>Washable, reusable design:</strong> clean and re-oil the filter instead of replacing it at each service.</li>
<li><strong>Custom engineered fit:</strong> built for specific bike airboxes, not universal fitting.</li>
<li><strong>Tested performance:</strong> filters are tested against filtration and airflow standards.</li>
<li><strong>Extensive Warranty:</strong> backed by K&amp;N's famous 10-Year/Million Mile Limited Warranty.</li>
</ul>
<h3><strong>What Makes K&amp;N's Cotton Gauze Design Different</strong></h3>
<p>Oiled gauze traps particles as air passes through, allowing higher airflow than a stock paper element while still filtering effectively. The media holds up to repeated cleaning, which underpins the reusable design.</p>`,
    faqs: [
      {
        question: "Are K&N, KN, and K and N air filters the same?",
        answer: "Yes. The variations are spelling differences in searches for the same brand.",
      },
      {
        question: "Are K&N filters washable and reusable?",
        answer: "Yes. They are cleaned, re-oiled, and reinstalled using the manufacturer's cleaning kit.",
      },
      {
        question: "How often should a K&N filter be cleaned?",
        answer: "It depends on riding conditions. A general guideline given is every 15,000 to 20,000 km, or sooner in dusty conditions. Visible dirt or reduced throttle response signal that cleaning is due.",
      },
      {
        question: "Will a K&N filter fit without modification?",
        answer: "Filters are model-specific, so choosing the correct listing should give a direct fit to the stock airbox.",
      },
      {
        question: "What warranty applies?",
        answer: "Most filters carry a \"10-Year/Million Mile Limited Warranty.\" Check the individual listing or K&N documentation for exact terms.",
      },
    ],
  },

  // 15. MadDog
  {
    name: "MadDog",
    slug: "maddog",
    aliases: ["maddog-lights", "mad-dog"],
    metaTitle: "MadDog Lights: Mad Dog Fog Lights for Bike | Store4Riders",
    metaDescription: "Shop genuine MadDog lights. Maddog fog lights for bike designed and made in India, across the Scout, Delta and Alpha range.",
    metaKeywords: "Biker helmets, riding jacket, biker gloves, motorcycle helmet, riding boots, maddog lights, maddog fog lights",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/maddog-logo-2.png",
    h1: "MadDog",
    productCount: 25,
    description: `<p>MadDog designs its auxiliary lights specifically for Indian roads and riding conditions. Its anti-glare TIR optics and 5000K warm-white color temperature are engineered for maximum clarity on unlit highways and in foggy conditions without blinding oncoming traffic.</p>
<p><strong>The Lineup:</strong> Scout, Scout-X, Delta, and Alpha. Choose based on required lumens: Scout/Scout-X for moderate upgrades, Delta for regular night touring, and Alpha for high-intensity adventure expeditions.</p>
<ul>
<li><strong>Anti-glare TIR optics:</strong> focused beam that avoids dazzling oncoming riders.</li>
<li><strong>5000K color temperature:</strong> tuned for clarity in Indian weather conditions.</li>
<li><strong>Scout to Alpha range:</strong> 3000 to 9600 lumens per pair.</li>
<li><strong>18-month warranty:</strong> full replacement coverage against manufacturing defects.</li>
</ul>
<h3>The MadDog Lights Range Explained</h3>
<p><strong>Scout and Scout-X:</strong> compact, 3000 to 4800 lumens per pair at 10 to 20 W each.</p>
<p><strong>Delta:</strong> 6400 lumens per pair at 30 W each.</p>
<p><strong>Alpha:</strong> 9600 lumens per pair at 40 W each, for long after-dark touring.</p>
<p>All models feature IP-rated weatherproof housings with optional clip-on yellow, black, and clear filter caps sold separately.</p>`,
    faqs: [
      {
        question: "What sets MadDog apart from generic auxiliary lights?",
        answer: "Its India-specific optics, 5000K road-tuned color temperature, anti-glare TIR lenses, and dedicated design and manufacturing in India.",
      },
      {
        question: "How do I choose a model?",
        answer: "Match output to need: Scout/Scout-X for moderate upgrades, Delta for regular night riding, Alpha for serious touring.",
      },
      {
        question: "Are the harness and switch included?",
        answer: "Complete sets include them; light-only options are available.",
      },
      {
        question: "What is the warranty?",
        answer: "An 18-month replacement warranty against manufacturing defects.",
      },
      {
        question: "What are the filters for?",
        answer: "Yellow for rain and fog, black for a discreet look, and clear for lens protection. They are optional.",
      },
    ],
  },

  // 16. Biking Brotherhood
  {
    name: "Biking Brotherhood",
    slug: "biking-brotherhood",
    aliases: ["biking-brotherhood-riding-gear", "bbg"],
    metaTitle: "Get Biking Brotherhood Riding Gear | BBG Riding Jacket | BBG Riding Boots",
    metaDescription: "Biking Brotherhood offers riding gear like riding jackets, pants, gloves, boots and motorcycle luggage with 6-month manufacturer warranty and fast shipping across India.",
    metaKeywords: "biking brotherhood, bbg riding jacket, bbg riding boots, biking brotherhood jacket, bbg jacket, bbg, biker brotherhood, bbg gears",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/9biking.png",
    h1: "Biking Brotherhood",
    productCount: 25,
    description: `<p>Biking Brotherhood Gears makes protective gear for motorcycle riding and racing. Veteran riders with more than 20 years of racing and touring experience founded the company to help riders pursue motorsport safely.</p>
<p><strong>Known for:</strong> affordable riding gear that still delivers strong protection.</p>
<p>All Biking Brotherhood riding gear carries a 6-month manufacturer warranty. The brand offers:</p>
<ul>
<li>Gloves</li>
<li>Jackets</li>
<li>Riding boots</li>
<li>Racing suits</li>
<li>Touring luggage</li>
</ul>`,
    faqs: [
      {
        question: "What is BBG?",
        answer: "BBG stands for Biking Brotherhood Gears, an Indian motorcycle protective apparel company founded by seasoned racers and tourers.",
      },
      {
        question: "Are BBG jackets CE certified?",
        answer: "Yes, BBG jackets feature CE-approved armor for elbows, shoulders, and back.",
      },
      {
        question: "What warranty does BBG provide?",
        answer: "All BBG riding gear includes a 6-month manufacturer warranty.",
      },
    ],
  },

  // 17. Amaroq Motorcycle Boots
  {
    name: "Amaroq Motorcycle Boots",
    slug: "amaroq-motorcycle-boots",
    aliases: ["amaroq", "amaroq-boots"],
    metaTitle: "Buy Amaroq Motorcycle Boots online",
    metaDescription: "Explore AMAROQ motorcycle boots combining performance, durability and style with 6-month warranty and lifelong support from AMAROQ.",
    metaKeywords: "riding boots, riding boots for men, bike riding boots, best riding boots, motorcycle boots, amaroq boots",
    logo: "/brands/amaroq.svg",
    h1: "Amaroq Motorcycle Boots",
    productCount: 4,
    description: `<p>AMAROQ began when a group of passionate bikers set out to create motorcycle footwear that combined real riding protection, rugged durability, and modern urban style. Designed through extensive materials research and collaborations with professional riders, AMAROQ boots embody the spirit of freedom and adventure.</p>
<p>Amaroq Valiant boots come with a 6-month warranty and lifelong support from AMAROQ.</p>`,
    faqs: [
      {
        question: "What is unique about Amaroq motorcycle boots?",
        answer: "Amaroq combines technical motorcycle protection (reinforced ankle cups, composite shanks, shift pads) with stylish designs comfortable for everyday wear.",
      },
      {
        question: "What warranty is provided on Amaroq boots?",
        answer: "Amaroq Valiant boots include a 6-month warranty and lifelong service support.",
      },
    ],
  },

  // 18. Vesrah Brake Pads
  {
    name: "Vesrah Brake Pads",
    slug: "vesrah-brake-pads",
    aliases: ["vesrah"],
    metaTitle: "Buy Vesrah brake pads | Vesrah ceramic brake pads online",
    metaDescription: "Explore the range of Vesrah brake pads here. Japanese sintered and ceramic brake pads delivered across India.",
    metaKeywords: "vesrah brake pads, vesrah ceramic brake pads, bike brake pads, brake pads, ceramic brake pads, brake pads price",
    logo: "/brands/vesrah.svg",
    h1: "Vesrah Brake Pads",
    productCount: 15,
    description: `<p>Vesrah, a Japanese company with manufacturing heritage dating back to 1950, is a world-renowned brake pad specialty manufacturer.</p>
<p>Vesrah sintered brake pads are globally celebrated among racers for instant bite and high fade resistance, while their ceramic brake pads offer thermal stability, low rotor wear, reduced brake dust, and quiet performance across touring, commuting, and sport riding.</p>`,
    faqs: [
      {
        question: "Where are Vesrah brake pads manufactured?",
        answer: "Vesrah brake pads are precision-engineered and manufactured in Japan.",
      },
      {
        question: "Sintered vs Ceramic Vesrah pads: which should I choose?",
        answer: "Sintered pads provide aggressive stopping bite ideal for track and fast sport riding; ceramic pads offer smooth initial bite, minimal dust, and longer rotor life for street and touring.",
      },
    ],
  },

  // 19. MotoTech Gear
  {
    name: "MotoTech Gear",
    slug: "mototech-gear",
    aliases: ["mototech-riding-gear", "mototech"],
    metaTitle: "Buy MotoTech Adventure & Motorcycle touring Products online",
    metaDescription: "Get the best riding gear and accessories by MotoTech now. All genuine products with warranty.",
    metaKeywords: "mototech, mototech riding jacket, mototech jacket, moto tech jacket",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/MotoTech.png",
    h1: "MotoTech Gear",
    productCount: 15,
    description: `<p>MotoTech manufactures genuine and quality motorbiking products and accessories that assist in self-protection, carrying luggage, securing luggage and convenient riding. Mototech Riding Jacket, Bungee Cords, Bungee Nets, Balaclava, Armoured Riding Pants, Riding Boots, Riding Gloves, Armour Inserts are some of the products of MotoTech.</p>`,
    faqs: [
      {
        question: "What products does MotoTech manufacture?",
        answer: "MotoTech makes motorcycle protective gear, riding jackets, gloves, bungee cords, cargo nets, balaclavas, and luggage accessories.",
      },
      {
        question: "Does MotoTech gear carry a warranty?",
        answer: "Yes, all genuine MotoTech products include manufacturer warranty support.",
      },
    ],
  },

  // 20. Lone Ranger
  {
    name: "Lone Ranger",
    slug: "lone-ranger",
    aliases: ["lone-ranger-india", "loneranger"],
    metaTitle: "Buy Lone Ranger Riding Jacket | Lone Ranger Gloves",
    metaDescription: "Shop Lone Ranger riding jackets, Kevlar denims, gloves, boots, touring bags, backpacks, magnetic tank bags, and leather motorcycle accessories with warranty.",
    metaKeywords: "lone ranger jacket, lone ranger riding jacket, lone ranger gloves, lone ranger india, loneranger, lone ranger",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/Lone-Ranger.png",
    h1: "Lone Ranger",
    productCount: 5,
    description: `<h2>Lone Ranger</h2>
<p>Lone Ranger aims to bring style to the motorcycle industry. Its team has worked in motorcycling for almost a decade, focusing on good-quality, dependable riding gear at reasonable prices, with an emphasis on safety and comfort.</p>
<p>The current range includes riding jackets and pants, Kevlar-based riding denims, gloves, riding boots, touring bags, backpacks, magnetic tank bags, thigh bags, and leather seats and accessories.</p>
<p>Most products carry a 6-month warranty from the date of purchase. The Air X and Primo gloves carry a 2-month warranty.</p>
<p>The brand describes itself as a source of safe, reliable, and stylish riding gear for motorcyclists.</p>`,
    faqs: [
      {
        question: "What is Lone Ranger known for?",
        answer: "Lone Ranger is known for stylish motorcycle gear including Kevlar riding jeans, textile jackets, gloves, and magnetic tank bags.",
      },
      {
        question: "What is the warranty on Lone Ranger products?",
        answer: "Most Lone Ranger products carry a 6-month warranty, while Air X and Primo gloves carry a 2-month warranty.",
      },
      {
        question: "Are Lone Ranger riding jeans reinforced with Kevlar?",
        answer: "Yes, Lone Ranger denims incorporate genuine Kevlar abrasion-resistant panels and armor pockets.",
      },
    ],
  },

  // 21. NGK Spark Plugs
  {
    name: "NGK Spark Plugs",
    slug: "ngk-spark-plugs",
    aliases: ["ngk"],
    metaTitle: "NGK Iridium Spark Plugs Online | Store4Riders",
    metaDescription: "Shop genuine NGK iridium spark plugs, including the NGK Iridium IX range. Laser-welded iridium tip for superior ignition, longer life, and BS6 compatibility.",
    metaKeywords: "Biker helmets, riding jacket, biker gloves, motorcycle helmet, riding boots, ngk spark plugs, ngk iridium",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/NGK.png",
    h1: "NGK Spark Plugs",
    productCount: 26,
    description: `<p>NGK has been manufacturing spark plugs since 1936. Many motorcycle makers fit NGK plugs as original equipment, and their iridium range is built to the same production standards.</p>
<p>The <strong>NGK Iridium IX</strong> is the model most riders choose when moving up from a standard copper plug. It has a fine iridium alloy tip for more precise ignition and longer service life.</p>
<ul>
  <li><strong>OEM supply:</strong> NGK supplies plugs to Honda, Royal Enfield, Bajaj, TVS, and other brands.</li>
  <li><strong>Iridium IX technology:</strong> A laser-welded iridium alloy tip for durability and accurate firing.</li>
  <li><strong>Long manufacturing history:</strong> Continuous production since 1936, with facilities on five continents.</li>
  <li><strong>Broad fitment:</strong> Iridium options for most motorcycles sold in India.</li>
</ul>
<h3>What Sets the Iridium IX Range Apart</h3>
<p>Standard NGK plugs use a nickel-alloy electrode that wears faster under heat. The Iridium IX replaces it with a laser-welded iridium alloy tip, which holds up better over time and keeps ignition consistent throughout the plug's life.</p>`,
    faqs: [
      {
        question: "How do standard and Iridium IX plugs differ?",
        answer: "Standard plugs use a nickel-alloy electrode. The Iridium IX uses a finer, laser-welded iridium tip, which lasts significantly longer and fires more consistently.",
      },
      {
        question: "Is NGK the original equipment brand for my bike?",
        answer: "NGK supplies many Indian motorcycle manufacturers, including Royal Enfield, Bajaj, TVS, Honda, and Hero.",
      },
      {
        question: "How can I verify a genuine NGK iridium plug?",
        answer: "Genuine plugs have a laser-etched part number on the ceramic insulator and the NGK logo stamped on the metal shell.",
      },
      {
        question: "Do NGK iridium plugs work with BS6 motorcycles?",
        answer: "Yes, the current iridium range is fully compatible with fuel-injected BS6 bikes as well as older carbureted models.",
      },
      {
        question: "How long does an Iridium IX plug last?",
        answer: "Many riders get 20,000 to 25,000 km under normal riding conditions with clean air and fuel systems.",
      },
    ],
  },

  // 22. BOBO Gears
  {
    name: "BOBO Gears",
    slug: "bobo-gears",
    aliases: ["bobo-phone-holder", "bobo", "bobo-gear"],
    metaTitle: "BOBO Mobile Holder for Bike | Waterproof & Anti-Vibration | Store4Riders",
    metaDescription: "Shop genuine BOBO mobile phone holders for bike with anti-vibration jaw-grip dampers, waterproof touchscreen cases, and wireless fast charging.",
    metaKeywords: "Biker helmets, riding jacket, biker gloves, motorcycle helmet, riding boots, bobo mobile holder, bike phone holder",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/BOBO-Logo-Blue-Black.png",
    h1: "BOBO Gears",
    productCount: 23,
    description: `<p>BOBO was founded in 2018 to make phone mounts that stay secure on rough Indian roads. Its designs include a jaw-grip clamp that leaves the phone visible and vibration dampers that keep the screen readable at speed.</p>
<p>The range covers several needs. Standard jaw-grip mounts suit dry-weather riding. Sealed waterproof holders with a touch-responsive window suit monsoon riding. Wireless charging models suit riders who want to keep their phone charged on long trips.</p>
<ul>
  <li><strong>Secure jaw-grip:</strong> Adjusts to many phone sizes without covering buttons or ports.</li>
  <li><strong>Vibration damping:</strong> Pro and Pro Plus damper tiers reduce camera damage and screen blur.</li>
  <li><strong>Waterproof options:</strong> Sealed cases with a touch-responsive window for monsoon navigation.</li>
  <li><strong>Wireless charging:</strong> Select models charge the phone while riding, without cables.</li>
</ul>
<h2>The BOBO Range Explained Simply</h2>
<p>Jaw-grip mounts like the BM1 and BM4 series clamp onto the phone and rotate 360 degrees. Waterproof lines such as the BM10H and BM11H seal the phone in a case with a clear touchscreen film. Wireless models in the BM11, BM12, and BM18 series add a 15W wireless pad or USB-C port.</p>`,
    faqs: [
      {
        question: "What is the difference between Pro and Pro Plus vibration dampers?",
        answer: "Pro Plus dampers handle stronger, higher-frequency vibration from single-cylinder engines and rough roads, preventing smartphone optical image stabilization (OIS) camera damage.",
      },
      {
        question: "Are waterproof holders fully sealed?",
        answer: "Yes, the BM10H and BM11H lines feature a fully sealed silicone case with a clear touchscreen film built for sustained heavy downpours.",
      },
      {
        question: "Will a BOBO holder fit my phone?",
        answer: "Most models fit smartphones from 4.0 to 7.2 inches wide.",
      },
      {
        question: "How does wireless charging work on bike holders?",
        answer: "The holder has an integrated wireless Qi pad or USB-C port wired directly to the motorcycle's 12V battery with an included fused harness.",
      },
      {
        question: "What warranty applies to BOBO phone mounts?",
        answer: "BOBO offers a 6-month to 1-year warranty against manufacturing defects depending on the model.",
      },
    ],
  },

  // 23. Race Dynamics
  {
    name: "Race Dynamics",
    slug: "race-dynamics",
    aliases: ["powertronic"],
    metaTitle: "Buy Race Dynamics Products online",
    metaDescription: "Buy genuine Race Dynamics ECU and electronic components online. R&D recognized electronic engine controls and FlashX hazard modules.",
    metaKeywords: "race dynamics flashx, powertronic, race dynamics ecu",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/RaceDynamics_Logohi-res_Primary.png",
    h1: "Race Dynamics",
    productCount: 16,
    description: `<p>Race Dynamics India Pvt. Ltd. is a privately owned automotive research and development company based in Bangalore. It has operated since 2004 and became a private limited company in 2008. The Government of India's Department of Scientific and Industrial Research recognises it. It is described as the first company in India to work successfully on automotive electronic engine control for motorsports, aftermarket, and OEM applications.</p>
<p>The company independently researches, designs, manufactures, sells, and supports automotive and related electronic components including the famous PowerTRONIC piggyback ECUs and FlashX hazard flasher modules.</p>`,
    faqs: [
      {
        question: "What is Race Dynamics?",
        answer: "A Bangalore-based automotive electronics R&D firm recognized by the Government of India, known for performance engine tuners and FlashX hazard modules.",
      },
      {
        question: "What is FlashX?",
        answer: "FlashX is a plug-and-play hazard warning flasher module offering multiple blinking patterns for increased road safety in poor visibility.",
      },
    ],
  },

  // 24. Scala Gears
  {
    name: "Scala Gears",
    slug: "scala-gears",
    aliases: ["scala", "scala-gear"],
    metaTitle: "Scala Riding Jacket & Gear Online | Store4Riders",
    metaDescription: "Shop Scala riding jackets, scala gloves and scala rain jacket options built for Indian roads and Indian weather. 6-month warranty and 5-year armour cover.",
    metaKeywords: "scala gears, scala riding jacket, scala gloves, scala rain jacket",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/scala.png",
    h1: "Scala Gears",
    productCount: 10,
    description: `<p>Scala Gears was founded by an Indian motorcyclist who designed gear for local roads rather than adapting a global product. The range includes riding jackets, gloves, and pants for city traffic and long highway trips.</p>
<p>The jacket lineup covers several riding styles. <strong>Blaze</strong> and <strong>Marvel</strong> suit commuting and touring, <strong>Brave</strong> and <strong>Thunder</strong> offer more protection for serious riders, and <strong>Akira</strong> is a women's-specific cut.</p>
<p>Gloves include <strong>Atlas</strong> and <strong>Viper</strong> for daily use, <strong>Trekker</strong> for long touring days, and <strong>Typhoon</strong>, a dedicated waterproof glove.</p>
<p>The <strong>Scala rain jacket</strong> and matching rain pant are designed to layer over existing riding gear during monsoon rides.</p>
<ul>
  <li><strong>Designed for Indian roads:</strong> built and tested by a rider in India.</li>
  <li><strong>Jackets for every style:</strong> from commuting to touring, with a women's fit in Akira.</li>
  <li><strong>Gloves for each ride:</strong> daily, touring, and waterproof options.</li>
  <li><strong>Monsoon ready:</strong> rain jacket and pant layer over your current gear.</li>
  <li><strong>Warranty:</strong> 6-month manufacturing defect warranty, with 5-year armour cover.</li>
</ul>
<h2>The Scala Range Explained</h2>
<p>The <strong>Blaze</strong> is the entry-level commuter jacket with mesh panels and shoulder and elbow armour. <strong>Marvel</strong> adds a fuller shell and thermal liner. <strong>Brave</strong> and <strong>Thunder</strong> are rugged, with extra armour. <strong>Akira</strong> is cut for women rather than resized from a men's pattern.</p>`,
    faqs: [
      {
        question: "What sets Scala riding jackets apart?",
        answer: "Designed by an Indian motorcyclist specifically for Indian weather, traffic, and touring conditions with high-flow ventilation.",
      },
      {
        question: "Which jacket suits daily commuting?",
        answer: "The Blaze jacket is lightweight with airflow mesh. For cooler weather or highway touring, Marvel adds a thermal liner.",
      },
      {
        question: "Are Scala gloves waterproof?",
        answer: "The Typhoon glove is fully waterproof; Atlas, Viper, and Trekker prioritize grip, dexterity, and airflow.",
      },
      {
        question: "What is the Scala rain jacket?",
        answer: "A dedicated waterproof shell engineered to be worn over standard armored riding jackets during heavy monsoons.",
      },
      {
        question: "What warranty applies to Scala gear?",
        answer: "6-month manufacturing defect warranty on apparel, with an exceptional 5-year cover on impact armor.",
      },
      {
        question: "Is there a women's specific jacket?",
        answer: "Yes, the Akira jacket is tailored specifically for women riders.",
      },
    ],
  },

  // 25. Pro-Spec Performance Parts
  {
    name: "Pro-Spec Performance Parts",
    slug: "pro-spec-performance-parts",
    aliases: ["pro-spec", "prospec"],
    metaTitle: "Get Pro-Spec Performance Parts today | Store4Riders",
    metaDescription: "Pro-Spec is committed to providing high quality unique motorcycle solutions designed and made in India at unbeatable prices.",
    metaKeywords: "pro-spec performance parts, pro-spec, easy cruise, visor extender",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/Pro-Spec-logo.png",
    h1: "Pro-Spec Performance Parts",
    productCount: 9,
    description: `<p>Pro-Spec is committed to providing you with high quality unique solutions designed and made in India for passionate motorcyclists at an unbeatable price and support.</p>
<p>Popular products include the Easy Cruise throttle assist, clip-on windshield visor extenders, stand extenders, and ergonomic handlebar risers.</p>`,
    faqs: [
      {
        question: "What does Pro-Spec manufacture?",
        answer: "Pro-Spec specializes in motorcycle touring accessories such as Easy Cruise mechanical cruise controls, universal windscreen extenders, and side stand enlargers.",
      },
      {
        question: "Where are Pro-Spec parts made?",
        answer: "Pro-Spec products are proudly designed, engineered, and manufactured in India.",
      },
    ],
  },

  // 26. Furygan
  {
    name: "Furygan",
    slug: "furygan",
    aliases: ["furygan-riding-gear-india"],
    metaTitle: "Furygan India | Furygan Riding Gear",
    metaDescription: "Buy Furygan riding jackets, gloves, pants, riding bags, protection guards at best prices. Fast delivery across India.",
    metaKeywords: "Biker helmets, riding jacket, biker gloves, motorcycle helmet, riding boots, furygan",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/furygan_logo.jpg",
    h1: "Furygan",
    productCount: 5,
    description: `<h2>Furygan</h2>
<p>Furygan was founded in 1969 by Jacques Segura in Nîmes, France. It began by making gloves for cycling, skiing, and motorcycling, and evolved into an international leader in motorcycle safety apparel.</p>
<p>The brand emphasizes safety, comfort, premium leather craftsmanship, and continuous innovation. Furygan never compromises on rider protection, working hand-in-hand with D3O armor technology.</p>
<p>Furygan's professional athlete roster includes MotoGP champions and Isle of Man TT legends such as Johann Zarco, Darryn Binder, and Michael Dunlop.</p>
<p>All Furygan products carry a 6-month warranty against manufacturing defects.</p>`,
    faqs: [
      {
        question: "Where is Furygan from?",
        answer: "Furygan is a prestigious French motorcycle apparel brand founded in 1969 in Nîmes, France.",
      },
      {
        question: "What warranty does Furygan offer?",
        answer: "A 6-month manufacturer warranty against production and stitching defects.",
      },
    ],
  },

  // 27. Shad
  {
    name: "Shad",
    slug: "shad",
    aliases: ["shad-luggage", "shad-cases"],
    metaTitle: "Buy Shad motorcycle Top Box online",
    metaDescription: "Get the best quality motorcycle top box / top case from SHAD delivered to your home. Fast shipping across India.",
    metaKeywords: "shad luggage, shad top box, SHAD Top Case SH29, SHAD Top Case SH39, SHAD Top Case SH42 Black",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/SHAD-LOGO-PNG.png",
    h1: "Shad",
    productCount: 7,
    description: `<p>SHAD is owned by NAD S.L. and was founded in 1973 in Barcelona, Spain. The brand designs and manufactures OEM top cases and comfort seats for major motorcycle manufacturers globally.</p>
<p>NAD S.L. handles research, engineering, and manufacturing at its state-of-the-art facility in Barcelona. Its products are factory-fitted by leading brands including BMW, Yamaha, KTM, Triumph, Honda, and Piaggio.</p>`,
    faqs: [
      {
        question: "What is SHAD known for?",
        answer: "SHAD is world-renowned for motorcycle top boxes, panniers, mounting kits, and comfort seats.",
      },
      {
        question: "Are SHAD top boxes waterproof?",
        answer: "Yes, SHAD hard cases feature perimeter rubber sealing gaskets that protect contents against rain and dust.",
      },
    ],
  },

  // 28. Cramster
  {
    name: "Cramster",
    slug: "cramster",
    aliases: ["cramster-by-rynox"],
    metaTitle: "Cramster by Rynox - Riding Jacket and Gloves available",
    metaDescription: "Get Cramster riding jackets, Cramster riding gloves, and touring luggage with fast shipping across India.",
    metaKeywords: "cramster jackets, cramster riding jacket, cramster riding gloves, cramster",
    logo: "/brands/cramster.svg",
    h1: "Cramster",
    productCount: 5,
    description: `<p>Cramster is India's pioneer motorcycle apparel and touring luggage brand. Operating for over two decades, it built a legendary cult following among Indian riders by delivering rugged durability, functional ergonomics, and timeless style.</p>
<p>Now backed by Rynox, Cramster combines its rugged heritage with modern manufacturing quality to bring high-performance gear to every motorcyclist.</p>`,
    faqs: [
      {
        question: "What is Cramster by Rynox?",
        answer: "Cramster is an iconic Indian touring brand now backed by Rynox to deliver modern manufacturing and trusted durability.",
      },
      {
        question: "What products are available from Cramster?",
        answer: "Touring jackets, all-weather gloves, tank bags, and heavy-duty saddlebags.",
      },
    ],
  },

  // 29. Invictus
  {
    name: "Invictus",
    slug: "invictus",
    aliases: ["invictus-gears"],
    metaTitle: "Invictus Gears - Motorcycle Saddlebags & Touring Luggage",
    metaDescription: "Shop Invictus Gears motorcycle saddlebags and tail bags. 100% made in India luggage designed to fit all bikes universally.",
    metaKeywords: "invictus gears, invictus saddle bag, motorcycle luggage, tail bag",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/Invictus.png",
    h1: "Invictus",
    productCount: 5,
    description: `<p>Invictus Gears was created in 2018 for providing riders of all bikes the safest possible way of carrying their luggage on long distances.</p>
<p>Invictus touring gear is made as universal as possible so that they fit all bikes regardless of make, from 90L expedition saddlebags to 76L detachable saddlebags and tail bags.</p>
<p>All Invictus bags are designed taking into consideration seat lengths, exhaust clearance, passenger comfort, and aftermarket saddle stays.</p>
<p>100% made in India products.</p>`,
    faqs: [
      {
        question: "Will Invictus bags fit my bike?",
        answer: "Yes, Invictus bags feature adjustable mounting straps designed to fit universally across cruisers, street bikes, and ADVs.",
      },
      {
        question: "Are Invictus luggage bags made in India?",
        answer: "Yes, 100% proudly designed and manufactured in India.",
      },
    ],
  },

  // 30. Barrel Exhaust
  {
    name: "Barrel Exhaust",
    slug: "barrel-exhaust",
    aliases: ["barrel"],
    metaTitle: "Buy Barrel Exhaust online | Royal Enfield Exhaust",
    metaDescription: "Shop genuine Barrel Exhaust systems for Royal Enfield, Bajaj Avenger 220, Hero XPulse, Ghost 2.0, dB killers, and accessories with warranty.",
    metaKeywords: "Biker helmets, riding jacket, biker gloves, motorcycle helmet, riding boots, barrel exhaust, royal enfield exhaust",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/Barrel-Exhaust.png",
    h1: "Barrel Exhaust",
    productCount: 1,
    description: `<p><strong>Barrel Exhaust</strong>: A premier motorcycle accessory brand that rethought exhaust design and built a reputation as a world-class automotive accessory brand.</p>
<p>The brand's range includes the Atom, Scud, and Canon Carbon exhausts, the Ghost 2.0 exhaust, specialized exhausts for the Hero XPulse, and custom dB killers.</p>`,
    faqs: [
      {
        question: "What makes Barrel Exhaust popular?",
        answer: "High-grade stainless steel construction, distinctive acoustic bass rumble, and optimized exhaust gas flow.",
      },
      {
        question: "Does Barrel Exhaust come with dB killers?",
        answer: "Yes, most Barrel Exhaust systems include removable acoustic dB killers to manage sound levels.",
      },
    ],
  },

  // 31. Snell
  {
    name: "Snell",
    slug: "snell",
    aliases: ["snell-accessories"],
    metaTitle: "Snell Motorcycle Gear & Accessories | Store4Riders",
    metaDescription: "Motorcycle Helmets, sprockets, air filters, riding jackets, gloves, boots and other riding accessories.",
    metaKeywords: "Biker helmets, riding jacket, biker gloves, motorcycle helmet, riding boots, snell",
    logo: "/brands/snell.svg",
    h1: "Snell",
    productCount: 0,
    description: `<p>Snell offers a focused range of motorcycle parts and rider accessories designed for performance, everyday reliability, and value for money.</p>`,
    faqs: [
      {
        question: "What products does Snell offer?",
        answer: "Motorcycle accessories, sprockets, air filters, and protective equipment.",
      },
    ],
  },

  // 32. Fly Racing
  {
    name: "Fly Racing",
    slug: "fly-racing",
    aliases: ["fly"],
    metaTitle: "Get the high quality riding gear by Fly Racing | EMI available",
    metaDescription: "Fly racing boots and apparel available in India with free shipping and 6-month manufacturer warranty.",
    metaKeywords: "fly racing, fly maverik, fly racing boots",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/Flyracing-logo_1_.png",
    h1: "Fly Racing",
    productCount: 5,
    description: `<p>Fly Racing makes apparel, accessories, and hard parts for motocross, off-road, and street riding. Inspired by racing, built for adventure, and engineered for high performance, the brand has operated since 1998.</p>
<p>Fly Racing boots, such as the renowned Maverik series, are widely celebrated for motocross and trail durability. All products carry a 6-month manufacturer warranty against defects.</p>`,
    faqs: [
      {
        question: "What is Fly Racing best known for?",
        answer: "Off-road and motocross gear, particularly Fly Maverik riding boots and rugged off-road apparel.",
      },
      {
        question: "What warranty does Fly Racing offer?",
        answer: "6-month manufacturer warranty on boots and gear.",
      },
    ],
  },

  // 33. Mototrendz
  {
    name: "Mototrendz",
    slug: "mototrendz",
    aliases: ["mototrendz-india"],
    metaTitle: "Buy Mototrendz Products online",
    metaDescription: "Mototrendz Customization is a top player in automotive customization services and motorcycle protective accessories in Mumbai.",
    metaKeywords: "mototrendz, Fork Seal Covers, ktm accessories, motorcycle accessories",
    logo: "/brands/mototrendz.svg",
    h1: "Mototrendz",
    productCount: 8,
    description: `<p>Mototrendz Customization is a leading specialist in motorcycle accessories and engineering solutions based in Mumbai. With an in-house team of engineers and designers, Mototrendz develops products that balance engineering precision, aesthetics, and ergonomics, including fork seal covers and tank pads.</p>`,
    faqs: [
      {
        question: "What is Mototrendz's most popular product?",
        answer: "Fork seal neoprene covers that protect front suspensions from dust, grit, and oil seal leaks.",
      },
      {
        question: "Are Mototrendz products universal?",
        answer: "They offer model-specific as well as universal motorcycle protective guards.",
      },
    ],
  },

  // 34. AutoStreet
  {
    name: "AutoStreet",
    slug: "autostreet",
    aliases: ["autostreet-biker-t-shirts"],
    metaTitle: "Buy AutoStreet Biker T-Shirts | Motorcycle T shirts online",
    metaDescription: "Buy AutoStreet biker t-shirts and enthusiast apparel with fast delivery across India.",
    metaKeywords: "biker t shirts, motorcycle t shirts, bike t shirt",
    logo: "/brands/autostreet.svg",
    h1: "AutoStreet",
    productCount: 9,
    description: `<p>AutoStreet is an automotive merchandise company that makes high-quality motoring apparel and lifestyle accessories for motorcycle and car enthusiasts. Its range includes themed 100% cotton T-shirts, jackets, hoodies, stickers, and casual riding lifestyle gear.</p>`,
    faqs: [
      {
        question: "What material are AutoStreet T-shirts made from?",
        answer: "Premium 100% combed cotton with durable screen-printed graphics.",
      },
      {
        question: "How fast is delivery for AutoStreet apparel?",
        answer: "Dispatched within 24-48 hours with express shipping across India.",
      },
    ],
  },

  // 35. 66Bhp
  {
    name: "66Bhp",
    slug: "66bhp",
    aliases: ["66-bhp"],
    metaTitle: "66Bhp Motorcycle Maintenance & Accessories | Store4Riders",
    metaDescription: "Motorcycle helmets, chain lubes, crash guards, and performance accessories from 66Bhp.",
    metaKeywords: "66bhp, 66bhp chain lube, 66bhp crash guard",
    logo: "/brands/66bhp.svg",
    h1: "66Bhp",
    productCount: 5,
    description: `<p>66Bhp provides specialized motorcycle maintenance fluids, chain lubes, crash protection, and riding accessories engineered for enthusiasts seeking dependable reliability.</p>`,
    faqs: [
      {
        question: "What products does 66Bhp provide?",
        answer: "High-performance chain sprays, motorcycle lubes, and protective accessories.",
      },
    ],
  },

  // 36. Moto Vanguard
  {
    name: "Moto Vanguard",
    slug: "moto-vanguard",
    aliases: ["motovanguard"],
    metaTitle: "Buy Moto Vanguard Luggage Solutions",
    metaDescription: "Buy top quality motorcycle top boxes, panniers, and luggage solutions by Moto Vanguard with 37 years of manufacturing experience.",
    metaKeywords: "bike top box, motorcycle top box, motorbike top box, aluminium top box, top box aluminium, bike back box, aluminium top box for bike",
    logo: "/brands/moto-vanguard.svg",
    h1: "Moto Vanguard",
    productCount: 6,
    description: `<p>With 37 years of precision manufacturing experience in engineering products, Moto Vanguard provides robust solutions for all your motorcycle touring luggage needs.</p>
<p>Its heavy-duty aluminium top boxes and panniers deliver superior strength, weather sealing, and impact resistance at affordable prices.</p>`,
    faqs: [
      {
        question: "What luggage does Moto Vanguard make?",
        answer: "Heavy-duty aluminium top cases, panniers, and universal mounting base plates.",
      },
      {
        question: "Are Moto Vanguard top boxes waterproof?",
        answer: "Yes, engineered with dual-lip rubber seals for total weatherproofing.",
      },
    ],
  },

  // 37. MotoreX
  {
    name: "MotoreX",
    slug: "motorex",
    aliases: ["motorex-oil"],
    metaTitle: "Explore the range of MOTOREX Oil of Switzerland here",
    metaDescription: "Explore MOTOREX Oil of Switzerland. Premium motorcycle engine oils, chain cleaners, chain sprays, and fluids backed by over 100 years of Swiss quality.",
    metaKeywords: "motorex, bike chain oil, chain spray, chain clean, motorex oil",
    logo: "/brands/motorex.svg",
    h1: "MotoreX",
    productCount: 1,
    description: `<p>Founded in 1917 as REX and rebranded as MOTOREX in 1947, MOTOREX Oil of Switzerland has focused on the highest standards of lubrication technology and services for over a century.</p>
<p>Used by world championship factory racing teams in KTM, Husqvarna, and off-road rallies, MOTOREX delivers maximum engine protection, smooth gearbox shifting, and premium chain care.</p>
<p>Explore the range of MOTOREX Oil of Switzerland here at Store4Riders.</p>`,
    faqs: [
      {
        question: "Where is MOTOREX manufactured?",
        answer: "MOTOREX is engineered and manufactured in Langenthal, Switzerland.",
      },
      {
        question: "Which racing teams use MOTOREX?",
        answer: "MOTOREX is the official lubricant partner for KTM Factory Racing, Husqvarna, and GasGas.",
      },
      {
        question: "Does MOTOREX offer chain maintenance products?",
        answer: "Yes, including MOTOREX Chain Clean Degreaser and Chain Lube Racing/Offroad.",
      },
    ],
  },

  // 38. SAS-TEC (Missing #1)
  {
    name: "SAS-TEC",
    slug: "sas-tec",
    aliases: ["sastec"],
    metaTitle: "Buy SAS-TEC Motorcycle Armor & Protectors Online | Store4Riders",
    metaDescription: "Shop SAS-TEC German engineered CE Level 2 viscoelastic motorcycle armor protectors for shoulders, elbows, back, and chest.",
    metaKeywords: "sas-tec, sastec, motorcycle armor, ce level 2 armor, viscoelastic protector",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/SAS-TEC-Logo-.jpg",
    h1: "SAS-TEC",
    productCount: 10,
    description: `<p>SAS-TEC is an innovative German safety manufacturer specializing in viscoelastic PU armor inserts for motorcycle protective apparel. Renowned worldwide for shock absorption, SAS-TEC protectors remain soft and flexible to wear while offering maximum CE Level 2 impact protection upon crash impact.</p>`,
    faqs: [
      {
        question: "What is SAS-TEC armor?",
        answer: "SAS-TEC is German viscoelastic memory foam armor that hardens upon impact to absorb energy while providing maximum comfort.",
      },
      {
        question: "What CE level is SAS-TEC armor?",
        answer: "Most SAS-TEC protectors are certified to European CE Level 2 standard EN 1621.",
      },
    ],
  },

  // 39. Safe-Tech Protectors (Missing #2)
  {
    name: "Safe-Tech Protectors",
    slug: "safe-tech-protectors",
    aliases: ["safe-tech", "safetech"],
    metaTitle: "Safe-Tech Protectors | CE Level 2 Armor Inserts | Store4Riders",
    metaDescription: "Buy genuine Safe-Tech CE Level 2 armor protectors for riding jackets and pants. High impact absorption with ergonomic ventilation.",
    metaKeywords: "safe-tech protectors, safe-tech, ce level 2 armor, motorcycle armor inserts",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/Safe-tech.jpg",
    h1: "Safe-Tech Protectors",
    productCount: 8,
    description: `<p>Safe-Tech is an Italian protective armor specialist engineering certified impact pads for motorcycle jackets and riding pants. Safe-Tech protectors feature lightweight, highly ventilated thermoplastic and viscoelastic designs offering certified CE Level 1 and Level 2 protection.</p>`,
    faqs: [
      {
        question: "What is Safe-Tech armor?",
        answer: "Safe-Tech is an Italian manufacturer of CE-certified protective armor inserts for motorcycle jackets and pants.",
      },
      {
        question: "Are Safe-Tech protectors CE certified?",
        answer: "Yes, certified under EN 1621-1 (limbs) and EN 1621-2 (back).",
      },
    ],
  },

  // 40. Shoerella (Missing #3)
  {
    name: "Shoerella",
    slug: "shoerella",
    aliases: ["shoe-cover", "shoerella-rain"],
    metaTitle: "Buy Shoerella Waterproof Rain Shoe Covers Online | Store4Riders",
    metaDescription: "Protect your shoes and boots with Shoerella waterproof silicone and rubber rain shoe covers for motorcyclists.",
    metaKeywords: "shoerella, waterproof shoe cover, rain shoe cover, motorcycle shoe protector",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/Shoerella-logo.jpg",
    h1: "Shoerella",
    productCount: 4,
    description: `<p>Shoerella produces flexible, reusable waterproof silicone shoe and boot covers designed to slip over standard footwear or riding boots during torrential rain, keeping shoes clean and dry.</p>`,
    faqs: [
      {
        question: "What is Shoerella?",
        answer: "Reusable waterproof protective shoe covers designed for daily commuters and riders during monsoon conditions.",
      },
      {
        question: "Are Shoerella shoe covers slip-resistant?",
        answer: "Yes, featuring textured anti-skid grooved soles for traction on wet pegs and tarmac.",
      },
    ],
  },

  // 41. Parani (Engineered by Sena)
  {
    name: "Parani",
    slug: "parani",
    aliases: ["parani-m10", "parani-a10", "parani-intercom", "parani-by-sena", "sena-parani"],
    metaTitle: "Buy Parani Bluetooth Helmet Intercom Online | Parani M10 & A10 | Store4Riders",
    metaDescription: "Shop genuine Parani Bluetooth helmet communicators engineered by Sena. Explore Parani M10 and A10 intercom systems with crystal clear audio, long battery life, and 1-year warranty.",
    metaKeywords: "parani, parani m10, parani a10, parani intercom, parani engineered by sena, bluetooth intercom, helmet communicator, sena intercom",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/PARANI-LOGO.png",
    h1: "Parani Helmet Communicators",
    productCount: 6,
    description: `<p><strong>Parani — Engineered by Sena.</strong> Parani delivers reliable motorcycle Bluetooth intercom technology backed by Sena's world-leading audio engineering at an accessible price point for everyday riders, weekend tourers, and daily commuters.</p>
<p>Equipped with crisp HD audio, long-range Bluetooth intercom connectivity, intuitive jog-dial and multi-button controls, and advanced digital noise reduction, Parani helmet communicators keep you connected, entertained with music, and guided with GPS directions on every ride.</p>
<ul>
<li><strong>Engineered by Sena:</strong> Backed by the world leader in motorcycle Bluetooth communication systems.</li>
<li><strong>Long Battery Life:</strong> Up to 16 hours of continuous talk time with fast USB Type-C charging.</li>
<li><strong>Clear Intercom Connectivity:</strong> Four-way intercom support with up to 1 km line-of-sight range.</li>
<li><strong>HD Audio &amp; FM Radio:</strong> High-definition helmet speakers, built-in FM radio, and voice prompts.</li>
<li><strong>1-Year Warranty:</strong> Official manufacturer warranty with replacement support against defects.</li>
</ul>
<h3>Popular Parani Intercoms</h3>
<p><strong>Parani M10:</strong> Features an integrated LCD display, jog dial controller, 4-way intercom, and FM tuner.</p>
<p><strong>Parani A10 / A20:</strong> Compact and aerodynamic multi-button Bluetooth communicators with boom and wired microphone options for full-face and modular helmets.</p>`,
    faqs: [
      {
        question: "What is Parani?",
        answer: "Parani is a line of accessible motorcycle Bluetooth communicators engineered by Sena, offering Sena's trusted communication technology, HD speakers, and intercom connectivity at an affordable price.",
      },
      {
        question: "Who makes Parani communicators?",
        answer: "Parani products are engineered and manufactured by Sena Technologies, the global leader in motorcycle communication systems.",
      },
      {
        question: "What is the range of the Parani M10 intercom?",
        answer: "The Parani M10 provides four-way Bluetooth intercom communication with a range of up to 1 km (0.6 miles) in open terrain.",
      },
      {
        question: "Is Parani water resistant?",
        answer: "Yes, Parani intercom units are weather-resistant and designed to handle daily rain, road spray, and dusty conditions.",
      },
      {
        question: "What warranty applies to Parani intercoms?",
        answer: "Parani intercoms sold by Store4Riders come with a 1-year official manufacturer warranty covering manufacturing and hardware defects.",
      },
    ],
  },

  // 42. Moto Torque
  {
    name: "Moto Torque",
    slug: "moto-torque",
    aliases: ["mototorque", "moto-torque-exhausts"],
    metaTitle: "Buy Moto Torque Motorcycle Crash Guards & Exhausts | Store4Riders",
    metaDescription: "Shop heavy-duty Moto Torque crash guards, bash plates, luggage racks, and performance exhausts with precision engineering.",
    metaKeywords: "moto torque, mototorque, crash guard, bash plate, royal enfield crash guard",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/MOTO-TORQUE-LOGO.jpg",
    h1: "Moto Torque",
    productCount: 8,
    description: `<p>Moto Torque engineers heavy-duty motorcycle protection and touring accessories designed to withstand aggressive adventure riding. From precision cold-bent crash guards and aircraft-grade aluminum sump guards to performance exhaust headers, Moto Torque ensures your motorcycle is shielded in every terrain.</p>`,
    faqs: [
      {
        question: "What does Moto Torque manufacture?",
        answer: "Moto Torque specializes in robust crash protection, engine guards, bash plates, saddle stays, and luggage racks.",
      },
      {
        question: "What material is used in Moto Torque crash guards?",
        answer: "Engineered from thick cold-rolled steel tubing with corrosion-resistant powder coating for maximum impact protection.",
      },
    ],
  },

  // 43. Carberry
  {
    name: "Carberry",
    slug: "carberry",
    aliases: ["carberry-motorcycles", "carberry-vibration-plate"],
    metaTitle: "Buy Carberry Vibration Reduction Plate | Store4Riders",
    metaDescription: "Carberry precision engineering components and vibration reduction systems for Royal Enfield motorcycles.",
    metaKeywords: "carberry, carberry vibration plate, royal enfield vibration, carberry motorcycles",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/Carberry.png",
    h1: "Carberry",
    productCount: 2,
    description: `<p>Carberry is famous in the motorcycling world for its mechanical innovation, notably developing custom V-Twin engines based on Royal Enfield powerplants. Their vibration-reduction cam support plates are engineered to stabilize the crankshaft and significantly reduce engine vibration on classic pushrod engines.</p>`,
    faqs: [
      {
        question: "What is the Carberry vibration plate?",
        answer: "It is a precision-machined stabilizer plate fitted to the engine to minimize crankshaft flex and dramatically smooth out vibrations.",
      },
    ],
  },

  // 44. Quipco
  {
    name: "Quipco",
    slug: "quipco",
    aliases: ["quipco-gears"],
    metaTitle: "Buy Quipco Outdoor, Rain Gear & Balaclavas | Store4Riders",
    metaDescription: "Shop Quipco all-weather riding balaclavas, skull caps, waterproof dry bags, and motorcycle touring accessories.",
    metaKeywords: "quipco, quipco balaclava, dry bag, waterproof riding gear",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/Quipco.jpg",
    h1: "Quipco",
    productCount: 5,
    menuGroup: "Luggage & Accessories",
    description: `<p>Quipco develops versatile outdoor and motorcycling accessories, including thermal balaclavas, quick-dry skull caps, windproof neck tubes, and heavy-duty roll-top dry bags designed for challenging weather expeditions.</p>`,
    faqs: [
      {
        question: "What is Quipco best known for?",
        answer: "Quipco is celebrated for its moisture-wicking and thermal balaclavas, neck warmers, and waterproof dry bags.",
      },
    ],
  },

  // 45. AGV Helmets
  {
    name: "AGV",
    slug: "agv",
    aliases: ["agv-helmets", "agvhelmets"],
    metaTitle: "AGV Helmets India | Buy Premium AGV Motorcycle Helmets Online",
    metaDescription: "Shop genuine AGV helmets in India. Explore AGV Pista GP RR, K6 S, K3, K1 S with official warranty, express shipping, and EMI at Store4Riders.",
    metaKeywords: "agv helmets, agv pista gp rr, agv k6 s, agv k3, agv k1 s, buy agv helmet india",
    logo: "/brands/agv.svg",
    h1: "AGV Helmets",
    description: `<p>AGV (Amisano Gino Valenza) is an iconic Italian motorcycle helmet manufacturer founded in 1947, synonymous with MotoGP world champions including Valentino Rossi. AGV helmets represent the pinnacle of aerodynamic development, optical clarity, carbon composite construction, and ultimate impact safety.</p>`,
    faqs: [
      {
        question: "Are AGV helmets ECE and DOT certified?",
        answer: "Yes, genuine AGV helmets meet or exceed strict global safety standards including ECE 22.06, DOT, and FIM homologation for track models.",
      },
      {
        question: "Which AGV helmet is best for daily street and touring?",
        answer: "The AGV K6 S and AGV K3 are outstanding versatile options offering ultra-lightweight comfort, wide field of vision, and premium ventilation.",
      },
    ],
  },

  // 46. HJC Helmets
  {
    name: "HJC",
    slug: "hjc",
    aliases: ["hjc-helmets", "hjchelmets"],
    metaTitle: "HJC Helmets India | Official HJC Full Face & Modular Helmets",
    metaDescription: "Explore HJC motorcycle helmets at Store4Riders. Certified RPHA 1, RPHA 71, RPHA 12, and i71 models with wind-tunnel engineered aerodynamics.",
    metaKeywords: "hjc helmets, rpha 1, rpha 71, rpha 12, hjc i71, hjc india",
    logo: "/brands/hjc.svg",
    h1: "HJC Helmets",
    description: `<p>HJC has specialized in manufacturing motorcycle helmets since 1971. Known worldwide for their advanced wind tunnel testing facility, premium PIM+ composite shells, and official Marvel and DC licensed editions, HJC delivers world-class safety and comfort.</p>`,
    faqs: [
      {
        question: "What is HJC RPHA series?",
        answer: "RPHA (Revolutionary Performance Helmet Advantage) is HJC's flagship race and sport-touring range featuring carbon-glass hybrid composite matrix shells.",
      },
    ],
  },

  // 47. MT Helmets
  {
    name: "MT Helmets",
    slug: "mt-helmets",
    aliases: ["mt", "mthelmets", "mt-helmet"],
    metaTitle: "MT Helmets Online India | ECE 22.06 Certified Helmets Best Price",
    metaDescription: "Buy MT Helmets in India with ECE 22.06 & DOT certification. Explore MT Thunder 4 SV, Blade 2 SV, Revenge 2, and Targo Pro at Store4Riders.",
    metaKeywords: "mt helmets, mt thunder 4 sv, mt revenge 2, mt blade 2 sv, mt helmet price",
    logo: "/brands/mt.svg",
    h1: "MT Helmets",
    description: `<p>Manufactories Tomas, S.A. (MT Helmets) from Spain is one of the world's most trusted helmet manufacturers. MT pioneered affordable ECE 22.06 safety certification with its acclaimed Thunder 4 SV, providing riders with top-tier impact protection, internal drop-down sun visors, and Pinlock-ready optical shields.</p>`,
    faqs: [
      {
        question: "Are MT Helmets ECE 22.06 certified?",
        answer: "Yes, MT was among the first global brands to achieve full ECE 22.06 homologation across models like the Thunder 4 SV and Jarama.",
      },
    ],
  },

  // 48. Alpinestars
  {
    name: "Alpinestars",
    slug: "alpinestars",
    aliases: ["alpinestar", "astars"],
    metaTitle: "Alpinestars Riding Gear India | Jackets, Boots, Gloves & Protection",
    metaDescription: "Shop authentic Alpinestars motorcycle riding gear in India. Premium CE-certified jackets, racing suits, Tech-Air compatible gear, gloves, and riding boots.",
    metaKeywords: "alpinestars, alpinestars jackets, alpinestars boots, alpinestars gloves, buy alpinestars india",
    logo: "/brands/alpinestars.svg",
    h1: "Alpinestars",
    description: `<p>Alpinestars is the world-leading manufacturer of professional motorsport racing products, motorcycle airbag protection, high-performance apparel, and technical footwear. Engineered in Asolo, Italy, Alpinestars gear protects MotoGP and Superbike champions worldwide.</p>`,
    faqs: [
      {
        question: "Are Alpinestars products CE certified?",
        answer: "Yes, Alpinestars jackets, pants, boots, and gloves adhere to European CE safety certifications with Level 1 and Level 2 impact protectors.",
      },
    ],
  },

  // 49. Shima
  {
    name: "Shima",
    slug: "shima",
    aliases: ["shima-gears", "shimaprotectors"],
    metaTitle: "Shima Motorcycle Riding Gear India | Jackets, Gloves & Boots",
    metaDescription: "Discover Shima European designed motorcycle riding gear. High-abrasion cordura jackets, leather track gloves, and reinforced waterproof boots.",
    metaKeywords: "shima riding gear, shima jackets, shima gloves, shima boots, shima india",
    logo: "/brands/shima.svg",
    h1: "Shima",
    description: `<p>Shima is a European riding gear brand established in 2009, dedicated to combining ergonomic riding comfort, modern urban aesthetics, and dependable impact resistance for sport, touring, and daily urban riders.</p>`,
    faqs: [
      {
        question: "Where is Shima gear designed?",
        answer: "Shima riding gear is designed and engineered in Europe with SAP (Shima ArmorPlus) memory foam protectors.",
      },
    ],
  },

  // 50. ViaTerra
  {
    name: "ViaTerra",
    slug: "viaterra",
    aliases: ["viaterra-gear", "viaterra-gears"],
    metaTitle: "ViaTerra Motorcycle Luggage & Riding Gear Online | Store4Riders",
    metaDescription: "Shop authentic ViaTerra motorcycle tank bags, tail bags, saddlebags, riding gloves, and monsoon waterproof gear designed for Indian terrain.",
    metaKeywords: "viaterra, viaterra tank bag, viaterra saddle bag, viaterra tail bag, viaterra gloves",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/VIATERRA_LOGO_PNG.png",
    h1: "ViaTerra",
    description: `<p>ViaTerra crafts durable, purpose-built motorcycle luggage and rider apparel tested thoroughly on Indian terrain and Himalayan expeditions. Known for their modular tank bags, heavy-duty Cordura saddlebags, and ergonomic riding gloves.</p>`,
    faqs: [
      {
        question: "Are ViaTerra bags waterproof?",
        answer: "ViaTerra luggage either features roll-top waterproof construction or includes dedicated 100% waterproof storm covers with high visibility reflectives.",
      },
    ],
  },

  // 51. DSG
  {
    name: "DSG",
    slug: "dsg",
    aliases: ["dsg-gear", "dsg-gears"],
    metaTitle: "DSG Riding Gear Online | Jackets, Pants & Gloves at Store4Riders",
    metaDescription: "Explore DSG riding gear. Proven multi-climate mesh jackets, reinforced riding denims, and touring gloves built for endurance riders.",
    metaKeywords: "dsg riding gear, dsg jackets, dsg gloves, dsg evo, dsg india",
    logo: "/brands/dsg.svg",
    h1: "DSG",
    description: `<p>DSG is one of India's pioneer motorcycle riding gear brands, providing battle-tested riding jackets, waterproof touring pants, and leather gloves tailored specifically for hot weather, monsoon downpours, and winter touring.</p>`,
    faqs: [
      {
        question: "Is DSG gear suitable for hot Indian summers?",
        answer: "Yes, DSG mesh jackets are renowned for extensive airflow panels while retaining high abrasion-resistant 600D fabric and CE certified armor.",
      },
    ],
  },

  // 52. Macna
  {
    name: "Macna",
    slug: "macna",
    aliases: ["macna-gears", "macna-india"],
    metaTitle: "Macna Motorcycle Gear India | Dutch Innovation Riding Apparel",
    metaDescription: "Buy Macna Dutch engineered riding jackets, gloves, and protective pants with NightEye technology at Store4Riders.",
    metaKeywords: "macna, macna jackets, macna nighteye, macna gloves, macna riding gear",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/macna-100x51.png",
    h1: "Macna",
    description: `<p>Macna is a Dutch motorcycle gear manufacturer celebrated for practical innovation such as NightEye microscopic glass-bead reflective technology, summer cooling vests, and Easy Cuff glove systems.</p>`,
    faqs: [
      {
        question: "What is Macna NightEye technology?",
        answer: "NightEye reflects headlights directly back to the source, making a dark jacket glow brightly at night without looking like safety gear during the day.",
      },
    ],
  },

  // 53. Motul
  {
    name: "Motul",
    slug: "motul",
    aliases: ["motul-oil", "motul-india"],
    metaTitle: "Motul Engine Oil, Chain Lube & Cleaners Online | Store4Riders",
    metaDescription: "Buy authentic Motul 300V, 7100 4T synthetic engine oils, C1 chain clean, and C2 chain lube at Store4Riders with fast delivery.",
    metaKeywords: "motul engine oil, motul 7100, motul 300v, motul chain lube, motul c1 c2",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/Motul-logo.png",
    h1: "Motul",
    menuGroup: "Parts & Performance",
    description: `<p>Motul is a French lubricant giant with over 170 years of heritage. Creators of the first semi-synthetic and 100% synthetic Ester-based motor oils, Motul produces unmatched engine lubricants, brake fluids, and chain maintenance products.</p>`,
    faqs: [
      {
        question: "What is the difference between Motul 7100 and 300V?",
        answer: "Motul 7100 is a 100% synthetic Ester oil formulated for high-mileage road performance and daily reliability, while 300V is an ultra-high performance racing oil formulated with double ester technology for peak horsepower.",
      },
    ],
  },

  // 54. Moto Fusion
  {
    name: "Moto Fusion",
    slug: "moto-fusion",
    aliases: ["motofusion"],
    metaTitle: "Moto Fusion Tail Tidies, Radiator Guards & Accessories | Store4Riders",
    metaDescription: "Precision laser-cut tail tidies, frame sliders, radiator guards, and luggage racks by Moto Fusion for popular performance motorcycles.",
    metaKeywords: "moto fusion, tail tidy, radiator guard, motorcycle accessories",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/mf.png",
    h1: "Moto Fusion",
    menuGroup: "Luggage & Accessories",
    description: `<p>Moto Fusion specializes in CNC precision-machined and laser-cut motorcycle bodywork accessories, including fender eliminator tail tidies, aluminum radiator grilles, and heavy-duty top rack plates.</p>`,
    faqs: [
      {
        question: "Are Moto Fusion tail tidies plug-and-play?",
        answer: "Yes, Moto Fusion products are precision engineered to mount to OEM chassis points with no permanent frame modification needed.",
      },
    ],
  },

  // 55. Motospunk
  {
    name: "Motospunk",
    slug: "motospunk",
    aliases: ["moto-spunk"],
    metaTitle: "Motospunk Crash Protection & Touring Accessories | Store4Riders",
    metaDescription: "Shop Motospunk crash guards, bash plates, luggage carriers, and highway footpegs engineered for adventure touring bikes.",
    metaKeywords: "motospunk, crash guard, bash plate, adventure bike accessories",
    logo: "/brands/motospunk.svg",
    h1: "Motospunk",
    menuGroup: "Luggage & Accessories",
    description: `<p>Motospunk designs and builds rugged crash protection cages, aluminum sump guards, and modular touring luggage racks for adventure tourers and dual-sport motorcycles.</p>`,
    faqs: [
      {
        question: "What coating is used on Motospunk crash guards?",
        answer: "Motospunk uses industrial electro-powder coating to resist scratches, stone chipping, and rust.",
      },
    ],
  },

  // 56. Axxis Helmets
  {
    name: "Axxis",
    slug: "axxis",
    aliases: ["axxis-helmets"],
    metaTitle: "Axxis Helmets India | Buy ECE Certified Helmets Online",
    metaDescription: "Shop sporty and colorful Axxis helmets at Store4Riders. Certified full face and street helmets with quick-release visors.",
    metaKeywords: "axxis helmets, axxis draken, axxis hawk, axxis helmet price",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/Axxis-Logo-2.png",
    h1: "Axxis Helmets",
    description: `<p>Axxis Helmets brings vibrant European graphics, high-impact polycarbonate shells, and stringent DOT/ECE safety certifications to passionate street riders.</p>`,
    faqs: [
      {
        question: "Are Axxis visors Pinlock ready?",
        answer: "Yes, most Axxis full face helmets come with Max Vision Pinlock prepared optical visors.",
      },
    ],
  },

  // 57. Vega Helmets
  {
    name: "Vega",
    slug: "vega",
    aliases: ["vega-helmets"],
    metaTitle: "Vega Helmets Online India | Full Face, Open Face & Off-Road Helmets",
    metaDescription: "Explore Vega helmets for daily commuting and touring. Reliable ISI and DOT certified helmets with anti-scratch visors.",
    metaKeywords: "vega helmets, vega bolt, vega crux, vega off road helmet",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/vega100x75.png",
    h1: "Vega Helmets",
    description: `<p>Vega Helmets is an Indian motorcycling pioneer delivering trusted, durable, and comfortable helmets suited for every daily commute and weekend road trip.</p>`,
    faqs: [
      {
        question: "Are Vega helmets ISI certified?",
        answer: "Yes, all official Vega models conform to ISI standards with select models meeting international DOT safety benchmarks.",
      },
    ],
  },

  // 58. Vemar Helmets
  {
    name: "Vemar",
    slug: "vemar",
    aliases: ["vemar-helmets"],
    metaTitle: "Vemar Helmets India | Italian Engineered Motorcycle Helmets",
    metaDescription: "Shop Vemar Italian motorcycle helmets at Store4Riders. Lightweight composite shell full face and dual sport adventure helmets.",
    metaKeywords: "vemar helmets, vemar kona, vemar storm, vemar india",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/vemar-100x51.png",
    h1: "Vemar Helmets",
    description: `<p>Vemar Helmets originated in Grosseto, Italy in 1975, pioneering composite fiber helmets for racing and adventure riding with aggressive aerodynamics.</p>`,
    faqs: [
      {
        question: "What shell material does Vemar use?",
        answer: "Vemar utilizes tri-composite (Carbon, Aramid, Fiberglass) and R-3P reinforced polymer shells.",
      },
    ],
  },

  // 59. Knox
  {
    name: "Knox",
    slug: "knox",
    aliases: ["knox-armour", "knox-protection"],
    metaTitle: "Knox Armor & Riding Apparel India | Tor & Urbane Pro Shirts",
    metaDescription: "Buy Knox UK impact protectors, armored shirts, and patented Dual Compound Scaphoid Protection System gloves at Store4Riders.",
    metaKeywords: "knox armor, knox urbane pro, knox sps, knox gloves, knox protection",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/knox.png",
    h1: "Knox",
    description: `<p>Planet Knox is the British pioneer of motorcycle body armor. Knox invented the patented SPS (Scaphoid Protection System) that prevents wrist fractures and revolutionized riding jackets with their CE Class AA armored shirts.</p>`,
    faqs: [
      {
        question: "What is the Knox Scaphoid Protection System (SPS)?",
        answer: "Knox SPS features palm sliders that slide across tarmac on impact instead of catching and gripping, eliminating hyper-extension and scaphoid bone fractures.",
      },
    ],
  },

  // 60. Sena
  {
    name: "Sena",
    slug: "sena",
    aliases: ["sena-technologies", "sena-bluetooth"],
    metaTitle: "Sena Motorcycle Bluetooth & Mesh Intercoms | Store4Riders",
    metaDescription: "Shop Sena 50S, 50R, spider, and SMH5 Bluetooth communication systems with Harman Kardon sound and Mesh 2.0 at Store4Riders.",
    metaKeywords: "sena bluetooth, sena 50s, sena 50r, sena intercom, buy sena india",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/SENA-LOGO.png",
    h1: "Sena",
    description: `<p>Sena Technologies is the undisputed global leader in motorcycle Bluetooth and Mesh intercom communication systems, featuring crystal-clear Harman Kardon audio and one-click Mesh networking.</p>`,
    faqs: [
      {
        question: "What is the advantage of Sena Mesh 2.0 over standard Bluetooth?",
        answer: "Mesh 2.0 connects virtually unlimited riders simultaneously and automatically reconnects anyone who temporarily moves out of range.",
      },
    ],
  },

  // 61. Dirtsack
  {
    name: "Dirtsack",
    slug: "dirtsack",
    aliases: ["dirtsack-luggage"],
    metaTitle: "Dirtsack Waterproof Motorcycle Luggage | Store4Riders",
    metaDescription: "Shop Dirtsack Frogman waterproof luggage, speedbags, and tank bags designed for off-road touring and endurance rides.",
    metaKeywords: "dirtsack, frogman, waterproof motorcycle luggage, dirtsack tail bag",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/Dirtsack.png",
    h1: "Dirtsack",
    description: `<p>Dirtsack is dedicated to bulletproof, 100% submersible waterproof soft luggage for adventure motorcyclists, famous for the ultra-tough Frogman roll-top collection.</p>`,
    faqs: [
      {
        question: "Are Dirtsack Frogman bags completely submersible?",
        answer: "Yes, Frogman series uses welded radio-frequency seams and heavy-duty TPU/PVC tarpaulin for 100% dust and waterproof performance.",
      },
    ],
  },

  // 62. Apollo Tyres
  {
    name: "Apollo",
    slug: "apollo",
    aliases: ["apollo-tyres", "apollo-tires"],
    metaTitle: "Apollo Motorcycle Radial Tyres | Alpha S1 & H1 | Store4Riders",
    metaDescription: "Buy Apollo Alpha radial motorcycle tires in India. High-grip dual-compound steel-belted radial tyres for performance bikes.",
    metaKeywords: "apollo tyres, apollo alpha h1, apollo alpha s1, motorcycle tyres india",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/APOLLO.png",
    h1: "Apollo",
    description: `<p>Apollo Tyres transformed the Indian motorcycle performance tyre market with its Alpha steel-belted radial range, providing exceptional cornering stability and wet grip.</p>`,
    faqs: [
      {
        question: "What is the Apollo Alpha H1 tire designed for?",
        answer: "Alpha H1 is designed for track and aggressive road riding with W-rated speed capability and zero-degree steel-belted construction.",
      },
    ],
  },

  // 63. Michelin
  {
    name: "Michelin",
    slug: "michelin",
    aliases: ["michelin-tyres", "michelin-tires"],
    metaTitle: "Michelin Motorcycle Tyres Online India | Road 5, Road 6, Pilot Street",
    metaDescription: "Buy genuine Michelin motorcycle tyres at Store4Riders. Explore Michelin Road 5, Road 6, Pilot Street 2, and Anakee adventure tires.",
    metaKeywords: "michelin tyres, michelin road 5, michelin road 6, michelin pilot street 2",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/MICHELIN.jpg",
    h1: "Michelin",
    description: `<p>Michelin is the official tire supplier to MotoGP and a world benchmark in dual-compound 2CT tyre technology, delivering unmatched wet braking and high-mileage longevity.</p>`,
    faqs: [
      {
        question: "Why are Michelin Road series tires so popular for touring?",
        answer: "Michelin Road 5 and Road 6 utilize patented X-Sipe technology and 100% silica compounds for class-leading wet braking and cornering grip even after thousands of kilometers.",
      },
    ],
  },

  // 64. Pirelli
  {
    name: "Pirelli",
    slug: "pirelli",
    aliases: ["pirelli-tyres", "pirelli-tires"],
    metaTitle: "Pirelli Motorcycle Tyres India | Diablo Rosso, Angel ST & Scorpion",
    metaDescription: "Shop authentic Pirelli motorcycle tires at Store4Riders. Track-tested Diablo Rosso IV, Angel GT touring, and Scorpion adventure dual-sport tyres.",
    metaKeywords: "pirelli tyres, diablo rosso iv, pirelli angel gt, pirelli scorpion rally",
    logo: "https://s3.ap-south-2.amazonaws.com/store4riders/brand-logos/PIRELLI.jpg",
    h1: "Pirelli",
    description: `<p>Pirelli is the sole official tyre supplier to the FIM Superbike World Championship, renowned for the Diablo performance racing series and Angel sport-touring tyres.</p>`,
    faqs: [
      {
        question: "What is Pirelli Diablo Rosso known for?",
        answer: "Diablo Rosso tyres deliver rapid warm-up times, race-derived profiles, and maximum edge grip for sport and superbike riders.",
      },
    ],
  },

  // BlueBurns
  {
    name: "BlueBurns",
    slug: "blueburns",
    aliases: ["blueburns-riding-gear","blue-burns"],
    metaTitle: "BlueBurns Riding Gear India | Buy Online | Store4Riders",
    metaDescription: "Shop authentic BlueBurns motorcycle apparel, protective gear and accessories with official warranty at Store4Riders.",
    metaKeywords: "blueburns, blueburns riding gear, motorcycle accessories india",
    logo: "/brands/blueburns.svg",
    h1: "BlueBurns",
    productCount: 8,
    description: `<p>BlueBurns manufactures dedicated riding accessories and motorcycle protective gear tailored for Indian touring and urban commuting conditions.</p>`,
    faqs: [
          {
                "question": "What products does BlueBurns offer?",
                "answer": "BlueBurns specializes in motorcycle accessories, touring comfort gear, and protective riding wear."
          }
    ],
  },

  // Inline 4
  {
    name: "Inline 4",
    slug: "inline-4",
    aliases: ["inline4","inline-four"],
    metaTitle: "Inline 4 Motorcycle Apparel & Accessories | Store4Riders",
    metaDescription: "Explore Inline 4 motorcycle merchandise, riding gear, and moto lifestyle apparel at Store4Riders.",
    metaKeywords: "inline 4, inline 4 riding gear, motorcycle apparel india",
    logo: "/brands/inline-4.svg",
    h1: "Inline 4",
    productCount: 12,
    description: `<p>Inline 4 delivers motorcycling lifestyle merchandise, touring apparel, and accessories crafted for passionate superbike and sportbike enthusiasts.</p>`,
    faqs: [
          {
                "question": "Are Inline 4 products genuine?",
                "answer": "Yes, all Inline 4 apparel and riding accessories sold at Store4Riders are 100% authentic."
          }
    ],
  },

  // REVLOX
  {
    name: "REVLOX",
    slug: "revlox",
    aliases: ["revlox-helmets","revlox-gears"],
    metaTitle: "REVLOX Motorcycle Helmets & Accessories | Store4Riders",
    metaDescription: "Shop REVLOX certified motorcycle helmets, visors and accessories with fast dispatch across India.",
    metaKeywords: "revlox, revlox helmets, buy revlox online",
    logo: "/brands/revlox.svg",
    h1: "REVLOX",
    productCount: 15,
    description: `<p>REVLOX engineers ergonomic motorcycle helmets and protective gear offering certified impact resistance, dual-visor convenience, and sharp styling.</p>`,
    faqs: [
          {
                "question": "Are REVLOX helmets certified?",
                "answer": "Yes, REVLOX helmets adhere to standard safety requirements including ISI certification."
          }
    ],
  },

  // RS Taichi
  {
    name: "RS Taichi",
    slug: "rs-taichi",
    aliases: ["taichi","rstaichi"],
    metaTitle: "RS Taichi Premium Japanese Riding Gear India | Store4Riders",
    metaDescription: "Shop authentic RS Taichi riding jackets, gloves, waterproof riding shoes, and CE armor from Japan at Store4Riders.",
    metaKeywords: "rs taichi, rs taichi india, rs taichi riding jacket, buy rs taichi",
    logo: "/brands/rs-taichi.svg",
    h1: "RS Taichi",
    productCount: 22,
    menuGroup: "Riding Gear",
    description: `<p>Founded in Japan, RS Taichi is globally revered for precision-crafted motorcycle racing suits, DRYMASTER waterproof jackets, technical gloves, and advanced CE Level 2 protective armor.</p>`,
    faqs: [
          {
                "question": "Why is RS Taichi considered a premium brand?",
                "answer": "RS Taichi utilizes Japanese engineering, innovative DRYMASTER membranes, and rigorous track testing to deliver supreme safety, fit, and ventilation."
          }
    ],
  },

  // Randy Sun
  {
    name: "Randy Sun",
    slug: "randy-sun",
    aliases: ["randysun"],
    metaTitle: "Randy Sun 100% Waterproof Breathable Riding Socks | Store4Riders",
    metaDescription: "Shop Randy Sun waterproof motorcycle socks and outdoor gear at Store4Riders. Keep your feet completely dry on every rainy expedition.",
    metaKeywords: "randy sun, waterproof socks, motorcycle waterproof socks india",
    logo: "/brands/randy-sun.svg",
    h1: "Randy Sun",
    productCount: 6,
    description: `<p>Randy Sun pioneers 100% waterproof and breathable membrane socks engineered to keep riders' feet dry and comfortable inside boots during heavy monsoons and river crossings.</p>`,
    faqs: [
          {
                "question": "Are Randy Sun socks truly 100% waterproof?",
                "answer": "Yes, Randy Sun socks feature a 3-layer poreless membrane that completely prevents water entry while allowing sweat vapor to escape."
          }
    ],
  },

  // Red Rooster
  {
    name: "Red Rooster",
    slug: "red-rooster",
    aliases: ["red-rooster-performance","rrp"],
    metaTitle: "Red Rooster Performance Exhausts India | Store4Riders",
    metaDescription: "Buy authentic Red Rooster Performance (RRP) stainless steel free-flow exhausts for Royal Enfield, KTM and Yamaha at Store4Riders.",
    metaKeywords: "red rooster exhaust, red rooster performance, rrp exhaust india",
    logo: "/brands/red-rooster.svg",
    h1: "Red Rooster Performance",
    productCount: 14,
    menuGroup: "Parts & Performance",
    description: `<p>Red Rooster Performance (RRP) manufactures race-derived SS304 aircraft-grade stainless steel performance exhausts delivering improved throttle response, horsepower gains, and a signature bass exhaust rumble.</p>`,
    faqs: [
          {
                "question": "Does Red Rooster exhaust rust?",
                "answer": "No, Red Rooster exhausts are crafted from pure commercial-grade 304 stainless steel, ensuring zero rust and lifetime durability."
          }
    ],
  },

  // THH Helmets
  {
    name: "THH Helmets",
    slug: "thh-helmets",
    aliases: ["thh","thh-helmet"],
    metaTitle: "THH Helmets India | Buy Certified Motorcycle Helmets | Store4Riders",
    metaDescription: "Shop THH full-face, off-road and modular helmets meeting ECE and DOT safety standards at Store4Riders.",
    metaKeywords: "thh helmets, thh motocross helmet, buy thh helmets india",
    logo: "/brands/thh-helmets.svg",
    h1: "THH Helmets",
    productCount: 18,
    menuGroup: "Helmet Brands",
    description: `<p>THH (Tong Ho Hsing) is an international helmet brand with extensive composite shell expertise, producing high-impact DOT/ECE approved motocross, enduro, and aerodynamic street helmets.</p>`,
    faqs: [
          {
                "question": "Are THH helmets good for off-road riding?",
                "answer": "Yes, THH off-road and motocross helmets provide wide goggle ports, high ventilation flow, and lightweight impact-absorbing composite shells."
          }
    ],
  },
];

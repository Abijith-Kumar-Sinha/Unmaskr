export interface Brand {
  name: string // display name
  core: string // the registrable label we match against (lower-case)
  domain: string // official registrable domain
  category: string
  // Other registrable domains the brand legitimately owns (regional sites, CDNs,
  // infrastructure) whose label is NOT the bare core — e.g. googleapis.com,
  // amazonaws.com. An exact match here is treated as official, not impersonation.
  altDomains?: string[]
  // True for global brands that defensively register their exact name across
  // virtually every non-throwaway TLD (google.de, amazon.co.uk, paypal.org…).
  // For these, the bare core on any non-suspicious TLD is treated as official,
  // which covers the ccTLD long tail without enumerating it. Deliberately NOT
  // set for regional banks, where exact-name-on-another-TLD is a real attack.
  ownsName?: boolean
  // The name is also an ordinary word (booking, chase, exodus): it only counts as
  // an impersonation with corroboration (lure word, abused TLD, homoglyph).
  generic?: boolean
}

// A protected brand list - the names attackers most often impersonate for
// Indian users. `core` is the second-level label; `domain` is the real one.
export const BRANDS: Brand[] = [
  // Banks
  { name: 'State Bank of India', core: 'onlinesbi', domain: 'onlinesbi.sbi', category: 'Bank' },
  { name: 'SBI', core: 'sbi', domain: 'sbi.co.in', category: 'Bank' },
  { name: 'HDFC Bank', core: 'hdfcbank', domain: 'hdfcbank.com', category: 'Bank' },
  // Country sites linked from icicibank.com's own homepage.
  { name: 'ICICI Bank', core: 'icicibank', domain: 'icicibank.com', category: 'Bank',
    altDomains: ['icicibank.ca', 'icicibank.co.uk', 'icicibank.de', 'icicibank.hk', 'icicibank.bh', 'icicibank.ae', 'icicibank.com.sg'] },
  { name: 'Axis Bank', core: 'axisbank', domain: 'axisbank.com', category: 'Bank', altDomains: ['axisbank.co.in'] },
  { name: 'Kotak', core: 'kotak', domain: 'kotak.com', category: 'Bank',
    altDomains: ['kotaksecurities.com', 'kotaklife.com', 'kotakmf.com', 'kotakbank.com'] },
  { name: 'Bank of Baroda', core: 'bankofbaroda', domain: 'bankofbaroda.in', category: 'Bank' },
  { name: 'Punjab National Bank', core: 'pnbindia', domain: 'pnbindia.in', category: 'Bank' },
  { name: 'Canara Bank', core: 'canarabank', domain: 'canarabank.com', category: 'Bank' },
  // UPI / Payments
  { name: 'Paytm', core: 'paytm', domain: 'paytm.com', category: 'Payments', ownsName: true,
    altDomains: ['paytmmoney.com', 'paytmmall.com', 'paytmbank.com', 'paytmpayments.com'] },
  { name: 'PhonePe', core: 'phonepe', domain: 'phonepe.com', category: 'Payments', ownsName: true },
  { name: 'Google Pay', core: 'gpay', domain: 'gpay.app', category: 'Payments' },
  { name: 'BHIM', core: 'bhim', domain: 'bhimupi.org.in', category: 'Payments' },
  { name: 'Razorpay', core: 'razorpay', domain: 'razorpay.com', category: 'Payments', ownsName: true },
  { name: 'PayPal', core: 'paypal', domain: 'paypal.com', category: 'Payments', ownsName: true,
    altDomains: ['paypalobjects.com', 'paypal-community.com'] },
  // Tech / Global
  { name: 'Google', core: 'google', domain: 'google.com', category: 'Tech', ownsName: true,
    altDomains: ['googleapis.com', 'gstatic.com', 'googleusercontent.com', 'googletagmanager.com', 'googlevideo.com', 'googlesyndication.com', 'googleadservices.com', 'googletagservices.com', 'google-analytics.com', 'googledomains.com', 'withgoogle.com', 'goo.gl', 'gmail.com', 'googlemail.com'] },
  { name: 'Microsoft', core: 'microsoft', domain: 'microsoft.com', category: 'Tech', ownsName: true,
    altDomains: ['microsoftonline.com', 'onmicrosoft.com', 's-microsoft.com', 'office.com', 'live.com', 'outlook.com', 'msftauth.net', 'windows.net', 'azureedge.net', 'sharepoint.com'] },
  { name: 'Apple', core: 'apple', domain: 'apple.com', category: 'Tech', ownsName: true,
    altDomains: ['apple-dns.net', 'icloud.com', 'mzstatic.com', 'cdn-apple.com', 'apple.news', 'apple-cloudkit.com', 'apple-mapkit.com'] },
  { name: 'Facebook', core: 'facebook', domain: 'facebook.com', category: 'Social', ownsName: true,
    altDomains: ['fbcdn.net', 'fb.com', 'facebook.net'] },
  { name: 'Instagram', core: 'instagram', domain: 'instagram.com', category: 'Social', ownsName: true,
    altDomains: ['cdninstagram.com', 'ig.me'] },
  { name: 'WhatsApp', core: 'whatsapp', domain: 'whatsapp.com', category: 'Social', ownsName: true,
    altDomains: ['whatsapp.net', 'wa.me'] },
  { name: 'Netflix', core: 'netflix', domain: 'netflix.com', category: 'Media', ownsName: true,
    altDomains: ['nflxext.com', 'nflximg.net', 'nflxvideo.net', 'netflix.shop'] },
  { name: 'YouTube', core: 'youtube', domain: 'youtube.com', category: 'Media', ownsName: true,
    altDomains: ['youtu.be', 'ytimg.com', 'youtube-nocookie.com'] },
  // Shopping
  { name: 'Amazon', core: 'amazon', domain: 'amazon.in', category: 'Shopping', ownsName: true,
    altDomains: ['amazonaws.com', 'amazon-adsystem.com', 'ssl-images-amazon.com', 'media-amazon.com', 'images-amazon.com', 'primevideo.com', 'a2z.com', 'amzn.to', 'amazon.jobs', 'amazon.science'] },
  { name: 'Flipkart', core: 'flipkart', domain: 'flipkart.com', category: 'Shopping', ownsName: true,
    altDomains: ['flixcart.com', 'fkrt.it', 'flipkartcareers.com'] },
  { name: 'Myntra', core: 'myntra', domain: 'myntra.com', category: 'Shopping', ownsName: true },
  // Logistics / Gov
  { name: 'India Post', core: 'indiapost', domain: 'indiapost.gov.in', category: 'Logistics', altDomains: ['ippbonline.com'] },
  { name: 'IRCTC', core: 'irctc', domain: 'irctc.co.in', category: 'Travel' },
  { name: 'EPFO', core: 'epfindia', domain: 'epfindia.gov.in', category: 'Government' },
  // Added in the red-team pass (gap B): Indian government-scheme, telecom and
  // insurance lures from the India smishing wave, plus more banks and the
  // global brands that dominate brand-phishing reports.
  { name: 'Income Tax Department', core: 'incometax', domain: 'incometax.gov.in', category: 'Government', altDomains: ['incometaxindia.gov.in'] },
  { name: 'UIDAI (Aadhaar)', core: 'uidai', domain: 'uidai.gov.in', category: 'Government' },
  { name: 'DigiLocker', core: 'digilocker', domain: 'digilocker.gov.in', category: 'Government' },
  { name: 'Parivahan (e-Challan)', core: 'parivahan', domain: 'parivahan.gov.in', category: 'Government' },
  { name: 'NPCI', core: 'npci', domain: 'npci.org.in', category: 'Payments' },
  { name: 'LIC', core: 'licindia', domain: 'licindia.in', category: 'Insurance' },
  { name: 'IndusInd Bank', core: 'indusind', domain: 'indusind.com', category: 'Bank' },
  { name: 'Yes Bank', core: 'yesbank', domain: 'yesbank.in', category: 'Bank' },
  { name: 'IDFC FIRST Bank', core: 'idfcfirstbank', domain: 'idfcfirstbank.com', category: 'Bank' },
  { name: 'Union Bank of India', core: 'unionbankofindia', domain: 'unionbankofindia.co.in', category: 'Bank' },
  { name: 'Bajaj Finserv', core: 'bajajfinserv', domain: 'bajajfinserv.in', category: 'Finance',
    altDomains: ['bajajfinservmarkets.in', 'bajajfinservhealth.in'] },
  // Bharti Airtel group runs national sites under its own name (airtel.ng, airtel.lk…).
  { name: 'Airtel', core: 'airtel', domain: 'airtel.in', category: 'Telecom', ownsName: true, altDomains: ['airtel.com', 'airtelbroadband.in'] },
  { name: 'LinkedIn', core: 'linkedin', domain: 'linkedin.com', category: 'Social', ownsName: true, altDomains: ['licdn.com', 'lnkd.in'] },
  { name: 'Coinbase', core: 'coinbase', domain: 'coinbase.com', category: 'Crypto', ownsName: true },
  { name: 'MetaMask', core: 'metamask', domain: 'metamask.io', category: 'Crypto' },
  // ── v0.4: widened list (OpenPhish targets + common global / Indian targets) ──
  // `generic`: the name is also an ordinary word (booking, chase, exodus), so it
  // only counts with corroboration (lure word / abused TLD / homoglyph).
  // Global
  { name: 'Booking.com', core: 'booking', domain: 'booking.com', category: 'Travel', generic: true, altDomains: ['bstatic.com'] },
  { name: 'Roblox', core: 'roblox', domain: 'roblox.com', category: 'Gaming', ownsName: true, altDomains: ['rbxcdn.com'] },
  { name: 'Discord', core: 'discord', domain: 'discord.com', category: 'Social', ownsName: true, altDomains: ['discord.gg', 'discordapp.com', 'discordapp.net', 'discord.media'] },
  { name: 'Steam', core: 'steamcommunity', domain: 'steamcommunity.com', category: 'Gaming', altDomains: ['steampowered.com', 'steamstatic.com'] },
  { name: 'DocuSign', core: 'docusign', domain: 'docusign.com', category: 'Tech', ownsName: true, altDomains: ['docusign.net'] },
  { name: 'Dropbox', core: 'dropbox', domain: 'dropbox.com', category: 'Tech', ownsName: true, altDomains: ['dropboxusercontent.com', 'db.tt'] },
  { name: 'Adobe', core: 'adobe', domain: 'adobe.com', category: 'Tech', ownsName: true, altDomains: ['adobelogin.com', 'typekit.net'] },
  { name: 'OneDrive', core: 'onedrive', domain: 'onedrive.com', category: 'Tech', altDomains: ['1drv.ms', 'live.com'] },
  { name: 'Yahoo', core: 'yahoo', domain: 'yahoo.com', category: 'Tech', ownsName: true, altDomains: ['yimg.com'] },
  { name: 'Spotify', core: 'spotify', domain: 'spotify.com', category: 'Media', ownsName: true, altDomains: ['scdn.co', 'spotifycdn.com'] },
  { name: 'Telegram', core: 'telegram', domain: 'telegram.org', category: 'Social', generic: true, altDomains: ['t.me', 'telegram.me'] },
  { name: 'X (Twitter)', core: 'twitter', domain: 'twitter.com', category: 'Social', ownsName: true, altDomains: ['x.com', 't.co', 'twimg.com'] },
  { name: 'TikTok', core: 'tiktok', domain: 'tiktok.com', category: 'Social', ownsName: true, altDomains: ['tiktokcdn.com', 'tiktokv.com'] },
  { name: 'DHL', core: 'dhl', domain: 'dhl.com', category: 'Logistics', ownsName: true },
  { name: 'FedEx', core: 'fedex', domain: 'fedex.com', category: 'Logistics', ownsName: true },
  { name: 'Wells Fargo', core: 'wellsfargo', domain: 'wellsfargo.com', category: 'Bank' },
  { name: 'Chase', core: 'chase', domain: 'chase.com', category: 'Bank', generic: true },
  { name: 'Bank of America', core: 'bankofamerica', domain: 'bankofamerica.com', category: 'Bank', altDomains: ['bofa.com'] },
  { name: 'American Express', core: 'americanexpress', domain: 'americanexpress.com', category: 'Bank', altDomains: ['aexp.com'] },
  { name: 'HSBC', core: 'hsbc', domain: 'hsbc.com', category: 'Bank', ownsName: true },
  { name: 'Trust Wallet', core: 'trustwallet', domain: 'trustwallet.com', category: 'Crypto' },
  { name: 'Exodus', core: 'exodus', domain: 'exodus.com', category: 'Crypto', generic: true },
  // India
  { name: 'Swiggy', core: 'swiggy', domain: 'swiggy.com', category: 'Shopping', ownsName: true },
  { name: 'Zomato', core: 'zomato', domain: 'zomato.com', category: 'Shopping', ownsName: true },
  { name: 'Meesho', core: 'meesho', domain: 'meesho.com', category: 'Shopping', ownsName: true },
  { name: 'Nykaa', core: 'nykaa', domain: 'nykaa.com', category: 'Shopping', ownsName: true },
  { name: 'AJIO', core: 'ajio', domain: 'ajio.com', category: 'Shopping' },
  { name: 'MakeMyTrip', core: 'makemytrip', domain: 'makemytrip.com', category: 'Travel' },
  { name: 'Zerodha', core: 'zerodha', domain: 'zerodha.com', category: 'Finance' },
  { name: 'Groww', core: 'groww', domain: 'groww.in', category: 'Finance' },
  { name: 'Upstox', core: 'upstox', domain: 'upstox.com', category: 'Finance' },
  { name: 'Policybazaar', core: 'policybazaar', domain: 'policybazaar.com', category: 'Insurance' },
  { name: 'SBI Card', core: 'sbicard', domain: 'sbicard.com', category: 'Bank' },
  { name: 'Jio', core: 'jio', domain: 'jio.com', category: 'Telecom' },
  { name: 'Passport Seva', core: 'passportindia', domain: 'passportindia.gov.in', category: 'Government' },
]

// Registries where only verified institutions can register a name: RBI made
// .bank.in mandatory for Indian banks (circular of 22 Apr 2025; IDRBT is the sole
// registrar) and reserved .fin.in for other financial entities. A name under these
// cannot be a lookalike bought by an attacker.
// .gov.in / .nic.in / .mil.in are reserved for the Government of India (NIC);
// .sbi and .statebank are SBI's own brand TLDs.
export const VERIFIED_SUFFIXES = new Set(['bank.in', 'fin.in', 'gov.in', 'nic.in', 'mil.in', 'sbi', 'statebank'])

// TLDs commonly abused for throwaway phishing domains.
export const SUSPICIOUS_TLDS = new Set([
  'xyz', 'top', 'tk', 'ml', 'ga', 'cf', 'gq', 'buzz', 'click', 'link',
  'live', 'online', 'site', 'website', 'club', 'icu', 'rest', 'cam',
  'support', 'work', 'fit', 'shop', 'store', 'win', 'bid', 'loan',
  // Cheap new gTLDs heavily used for phishing (red-team RT-03: a brand's
  // exact name on these read as "official" before).
  'sbs', 'cfd', 'bond', 'cyou', 'autos', 'lol', 'beauty', 'quest', 'mom',
  'hair', 'skin', 'makeup', 'boats', 'monster', 'vip', 'pw',
])

// Mainstream TLDs where a global brand that owns its name is expected to sit
// (2-letter ccTLDs are accepted separately in scoring.ts mainstreamTld()).
export const COMMON_TLDS = new Set([
  'com', 'in', 'co', 'org', 'net', 'gov', 'app', 'io', 'me', 'info', 'dev', 'biz', 'edu',
])

// Words attackers bolt onto a brand to manufacture urgency. The second line is
// India-specific bait (net-banking, Aadhaar/KYC, e-challan, parcel redelivery).
export const LURE_WORDS = [
  'login', 'verify', 'secure', 'account', 'update', 'kyc', 'support',
  'reward', 'refund', 'offer', 'bonus', 'wallet', 'signin', 'confirm',
  'alert', 'block', 'unlock', 'service', 'help', 'care', 'official',
  'netbanking', 'banking', 'yono', 'cashback', 'aadhaar', 'aadhar', 'ekyc', 'redeem',
  'prize', 'lottery', 'gift', 'claim', 'pension', 'subsidy', 'challan', 'fastag',
  'parcel', 'redelivery', 'tracking', 'points', 'creditcard', 'upi',
]

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
}

// A protected brand list - the names attackers most often impersonate for
// Indian users. `core` is the second-level label; `domain` is the real one.
export const BRANDS: Brand[] = [
  // Banks
  { name: 'State Bank of India', core: 'onlinesbi', domain: 'onlinesbi.sbi', category: 'Bank' },
  { name: 'SBI', core: 'sbi', domain: 'sbi.co.in', category: 'Bank' },
  { name: 'HDFC Bank', core: 'hdfcbank', domain: 'hdfcbank.com', category: 'Bank' },
  { name: 'ICICI Bank', core: 'icicibank', domain: 'icicibank.com', category: 'Bank' },
  { name: 'Axis Bank', core: 'axisbank', domain: 'axisbank.com', category: 'Bank', altDomains: ['axisbank.co.in'] },
  { name: 'Kotak', core: 'kotak', domain: 'kotak.com', category: 'Bank' },
  { name: 'Bank of Baroda', core: 'bankofbaroda', domain: 'bankofbaroda.in', category: 'Bank' },
  { name: 'Punjab National Bank', core: 'pnbindia', domain: 'pnbindia.in', category: 'Bank' },
  { name: 'Canara Bank', core: 'canarabank', domain: 'canarabank.com', category: 'Bank' },
  // UPI / Payments
  { name: 'Paytm', core: 'paytm', domain: 'paytm.com', category: 'Payments', ownsName: true },
  { name: 'PhonePe', core: 'phonepe', domain: 'phonepe.com', category: 'Payments', ownsName: true },
  { name: 'Google Pay', core: 'gpay', domain: 'gpay.app', category: 'Payments' },
  { name: 'BHIM', core: 'bhim', domain: 'bhimupi.org.in', category: 'Payments' },
  { name: 'Razorpay', core: 'razorpay', domain: 'razorpay.com', category: 'Payments', ownsName: true },
  { name: 'PayPal', core: 'paypal', domain: 'paypal.com', category: 'Payments', ownsName: true },
  // Tech / Global
  { name: 'Google', core: 'google', domain: 'google.com', category: 'Tech', ownsName: true,
    altDomains: ['googleapis.com', 'gstatic.com', 'googleusercontent.com', 'googletagmanager.com', 'googlevideo.com', 'googlesyndication.com', 'googleadservices.com', 'google-analytics.com', 'googledomains.com', 'withgoogle.com', 'goo.gl'] },
  { name: 'Microsoft', core: 'microsoft', domain: 'microsoft.com', category: 'Tech', ownsName: true,
    altDomains: ['microsoftonline.com', 'office.com', 'live.com', 'outlook.com', 'msftauth.net', 'windows.net', 'azureedge.net', 'sharepoint.com'] },
  { name: 'Apple', core: 'apple', domain: 'apple.com', category: 'Tech', ownsName: true,
    altDomains: ['apple-dns.net', 'icloud.com', 'mzstatic.com', 'cdn-apple.com'] },
  { name: 'Facebook', core: 'facebook', domain: 'facebook.com', category: 'Social', ownsName: true,
    altDomains: ['fbcdn.net', 'fb.com', 'facebook.net'] },
  { name: 'Instagram', core: 'instagram', domain: 'instagram.com', category: 'Social', ownsName: true,
    altDomains: ['cdninstagram.com', 'ig.me'] },
  { name: 'WhatsApp', core: 'whatsapp', domain: 'whatsapp.com', category: 'Social', ownsName: true,
    altDomains: ['whatsapp.net', 'wa.me'] },
  { name: 'Netflix', core: 'netflix', domain: 'netflix.com', category: 'Media', ownsName: true,
    altDomains: ['nflxext.com', 'nflximg.net', 'nflxvideo.net'] },
  { name: 'YouTube', core: 'youtube', domain: 'youtube.com', category: 'Media', ownsName: true,
    altDomains: ['youtu.be', 'ytimg.com', 'youtube-nocookie.com'] },
  // Shopping
  { name: 'Amazon', core: 'amazon', domain: 'amazon.in', category: 'Shopping', ownsName: true,
    altDomains: ['amazonaws.com', 'amazon-adsystem.com', 'ssl-images-amazon.com', 'media-amazon.com', 'images-amazon.com', 'primevideo.com', 'a2z.com', 'amzn.to'] },
  { name: 'Flipkart', core: 'flipkart', domain: 'flipkart.com', category: 'Shopping', ownsName: true,
    altDomains: ['flixcart.com', 'fkrt.it'] },
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
  { name: 'Bajaj Finserv', core: 'bajajfinserv', domain: 'bajajfinserv.in', category: 'Finance' },
  { name: 'Airtel', core: 'airtel', domain: 'airtel.in', category: 'Telecom', altDomains: ['airtel.com'] },
  { name: 'LinkedIn', core: 'linkedin', domain: 'linkedin.com', category: 'Social', ownsName: true, altDomains: ['licdn.com', 'lnkd.in'] },
  { name: 'Coinbase', core: 'coinbase', domain: 'coinbase.com', category: 'Crypto', ownsName: true },
  { name: 'MetaMask', core: 'metamask', domain: 'metamask.io', category: 'Crypto' },
]

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

// Local copy of the legal texts. The same file is copied to the server (/legal/* pages, scripts/syncLegal.js)
// and to the website (website/src/legal.js -> /terms, /privacy, /refund-policy, /contact).
// IMPORTANT: have a lawyer review these documents before public launch (DoT/TRAI, IT Act, DPDP Act 2023).

// Who runs CallingKaro: shown on the Contact page and inside every policy (Razorpay needs a full Indian address).
export const BUSINESS = {
  brand: 'CallingKaro',
  owner: 'Vishal',
  type: 'Individual (sole proprietor)',
  address: 'R-11, Welcome Colony, North East Delhi, Delhi - 110053, India',
  email: 'vk722413@gmail.com',
  phone: '+91 95407 92427',
  website: 'https://callingkaro.in',
  hours: 'Monday to Saturday, 10:00 AM to 6:00 PM IST (email any time)',
};

const OPERATOR = `${BUSINESS.brand} is operated by ${BUSINESS.owner}, an ${BUSINESS.type.toLowerCase()}, ${BUSINESS.address}`;
const CONTACT_LINE = `Email ${BUSINESS.email} · Phone ${BUSINESS.phone} · Address ${BUSINESS.address}`;

export const TERMS_OF_USE = {
  title: 'Terms and Conditions',
  updated: 'Version v2 - November 2026',
  sections: [
    {
      heading: '1. Who we are',
      body: `${OPERATOR} ("we", "us"). These Terms apply to the CallingKaro Android app and the website ${BUSINESS.website}. By installing the app, creating an account or buying credits you agree to these Terms, our Privacy Policy and our Refund and Cancellation Policy.`,
    },
    {
      heading: '2. What CallingKaro is',
      body: 'CallingKaro lets you place calls from the app over the internet to mobile and landline numbers in India. Calls are carried by a licensed telecom/CPaaS partner. The person you call receives a normal phone call. You must be at least 18 years old, or use the app with the consent of a parent or guardian.',
    },
    {
      heading: '3. Credits and prices',
      body: 'Calls use credits. 1000 credits = 1 minute of talk time, charged per second (for example 2 minutes 15 seconds = 2,250 credits). You need at least 1000 credits to start a call. Calls that are not answered, busy or failed cost nothing. Credits come from paid minute packs, rewarded video ads, the spin wheel and promotions. Minute packs are shown with their price in Indian Rupees (INR, taxes included) in the app before you pay, for example Rs 100 = 80 minutes. Credits have no cash value, cannot be transferred and cannot be withdrawn. Paid credits do not expire. We may change prices for future purchases; a change never affects credits you already bought.',
    },
    {
      heading: '4. Payments',
      body: 'Payments are processed securely by our payment partners (Razorpay, or Google Play Billing for purchases made through Google Play) using UPI, cards, net banking or wallets. We never see or store your full card, UPI PIN or bank details. Credits are added to your wallet automatically and instantly once the payment is confirmed. Refunds and cancellations follow our Refund and Cancellation Policy.',
    },
    {
      heading: '5. Acceptable use - strictly prohibited',
      body: 'You must NOT use CallingKaro to: harass, threaten, stalk or abuse anyone; make fraudulent, scam, phishing or extortion calls; impersonate any person, company, bank or government body; make spam, robocalls or unsolicited marketing calls; call numbers that have asked not to be called; or break any law. We may suspend accounts, block numbers and share information with law enforcement where required by law.',
    },
    {
      heading: '6. Caller ID',
      body: 'Your calls show a number owned or verified by CallingKaro, never a spoofed or random number. People who call that number back hear a message explaining it is used by CallingKaro and how to report misuse.',
    },
    {
      heading: '7. Call recording',
      body: 'If you record a call, an announcement / beep is played so that both sides know the call is being recorded. You are responsible for obtaining any consent the law requires from the other person. Recordings are stored on your phone; copies held by our provider are deleted automatically after a limited period.',
    },
    {
      heading: '8. Rewards',
      body: 'Rewarded ads and spins may be limited. Rewards are decided by our servers. Using emulators, automation, multiple accounts or any trick to collect rewards may lead to removal of credits and account suspension.',
    },
    {
      heading: '9. Availability',
      body: 'Call quality depends on your internet connection and our partners, and the service may sometimes be unavailable for maintenance. Emergency numbers (100, 101, 102, 108, 112) and short codes cannot be dialled from CallingKaro - always use your phone dialer for emergencies.',
    },
    {
      heading: '10. Account and termination',
      body: 'You sign in with your email and a one-time code. You can delete your account at any time from Settings. We may suspend or close accounts that break these Terms. We keep billing and call metadata for the period required by law.',
    },
    {
      heading: '11. Limitation of liability',
      body: 'The service is provided "as is". To the extent allowed by law, we are not liable for indirect or consequential loss, and our total liability for any claim is limited to the amount you paid us in the 3 months before the claim.',
    },
    {
      heading: '12. Governing law',
      body: 'These Terms are governed by the laws of India. Courts at Delhi, India have exclusive jurisdiction.',
    },
    {
      heading: '13. Changes',
      body: 'We may update these Terms. The latest version is always in the app and on our website; continuing to use CallingKaro after a change means you accept it.',
    },
    {
      heading: '14. Contact and grievances',
      body: `Questions or complaints: ${CONTACT_LINE}. We reply within 2 working days.`,
    },
  ],
};

export const PRIVACY_POLICY = {
  title: 'Privacy Policy',
  updated: 'Version v2 - November 2026',
  sections: [
    {
      heading: '1. Who is responsible',
      body: `${OPERATOR}. This policy explains what we collect through the CallingKaro app and ${BUSINESS.website}, and why.`,
    },
    {
      heading: '2. Data we collect',
      body: 'Email address (to sign you in), a device identifier (to protect free rewards from abuse), call metadata needed for billing and legal retention (your account, the number you called, start time, duration, credits charged, caller ID used), wallet and purchase records (order ID, amount, status), the IP address of requests (for security), and reports you submit.',
    },
    {
      heading: '3. Data that stays on your phone',
      body: 'Your contacts are read only on your phone to show names and let you call quickly - they are NEVER uploaded to our servers. Your call history list, call notes, settings and downloaded recordings are stored on your phone and are deleted when you clear app data or uninstall.',
    },
    {
      heading: '4. Call recordings',
      body: 'Recording only happens when you turn it on, and an announcement is played. Our telecom provider holds a temporary encrypted copy which we delete automatically after a short period; the app downloads your copy to your phone.',
    },
    {
      heading: '5. Payments',
      body: 'Payments are processed by Razorpay (or Google Play Billing). Card, UPI and bank details are entered on the payment partner\'s secure page, encrypted and handled under PCI-DSS. We never see or store your full card number, CVV or UPI PIN - only an order reference, amount and status. Please also read Razorpay\'s privacy policy at https://razorpay.com/privacy/.',
    },
    {
      heading: '6. Ads',
      body: "Rewarded video ads are served by Google AdMob, which may use your advertising ID and device information according to Google's policies. Where required, we ask for consent for personalised ads. You can reset or delete your advertising ID in Android settings.",
    },
    {
      heading: '7. Why we use data',
      body: 'To provide calls, bill credits, process payments and refunds, prevent fraud and abuse, respond to complaints and legal requests, and improve reliability. We do not sell your personal data. We share data only with the service providers needed to run CallingKaro (telecom partner, payment partner, email delivery, hosting) or when the law requires it.',
    },
    {
      heading: '8. Cookies',
      body: 'The website uses only cookies that are needed for it to work (for example to keep a signed-in session). We do not use them to track you on other websites.',
    },
    {
      heading: '9. Security and retention',
      body: 'Data is sent over encrypted connections (HTTPS) and access is restricted. Account data is kept while your account is active. Call metadata and billing records are kept for the period required by Indian telecom and tax rules, then deleted.',
    },
    {
      heading: '10. Your rights (DPDP Act 2023)',
      body: 'You can access and correct your data, withdraw consent, and delete your account from Settings > Account > Delete account, or by emailing us. Deletion anonymises your profile; records we must keep by law are retained only for that purpose.',
    },
    {
      heading: '11. Grievance officer',
      body: `${BUSINESS.owner}, ${CONTACT_LINE}. We acknowledge complaints within 2 working days and resolve them within 30 days.`,
    },
  ],
};

export const REFUND_POLICY = {
  title: 'Refund and Cancellation Policy',
  updated: 'Version v2 - November 2026',
  sections: [
    {
      heading: '1. What you buy',
      body: `${BUSINESS.brand} sells digital minute packs (call credits) used inside the app. Nothing is shipped: credits are delivered to your in-app wallet instantly after the payment is confirmed, usually within a few seconds. If credits do not appear within 30 minutes, contact us with your order ID.`,
    },
    {
      heading: '2. Payment taken but credits not added',
      body: 'If money was deducted but the credits were not added to your wallet, we will either add the credits or refund the full amount to your original payment method - your choice. Payments that fail at the bank or payment partner are reversed automatically by the bank / Razorpay, usually within 5-7 working days.',
    },
    {
      heading: '3. Refund of unused credits',
      body: 'You can ask for a refund of a minute pack within 7 days of purchase if none of its credits have been used. Partly used packs, credits from rewarded ads, the spin wheel, the daily check-in, referrals, welcome bonuses and promotions are not refundable and have no cash value.',
    },
    {
      heading: '4. Call quality problems',
      body: 'Unanswered, busy and failed calls are never charged. If a connected call had a technical problem caused by us (for example it was charged but you could not hear anything), tell us within 7 days with the time and number called and we will return the credits for that call to your wallet.',
    },
    {
      heading: '5. Cancellation',
      body: 'Minute packs are one-time purchases - there is no subscription and nothing renews automatically, so there is nothing to cancel later. You can cancel a payment before completing it on the payment page. Once a pack is delivered, it can only be refunded as described above. You may delete your account at any time; unused paid credits can be refunded on request if the purchase is within the 7-day window.',
    },
    {
      heading: '6. How refunds are paid',
      body: 'Approved refunds are made to the original payment method (UPI, card, net banking or wallet) through Razorpay or Google Play within 5-7 working days of approval. The related credits are removed from your wallet. If a payment is refunded or charged back through your bank, the related credits are also removed.',
    },
    {
      heading: '7. How to ask for a refund',
      body: `Email ${BUSINESS.email} or call ${BUSINESS.phone} with your registered email address, order ID (shown in the app under Wallet) and the reason. We reply within 2 working days.`,
    },
  ],
};

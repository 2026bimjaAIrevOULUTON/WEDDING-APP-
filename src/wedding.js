// Everything specific to one wedding lives here. A new customer = a new copy of this object.
// Times are India time (IST), written as YYYY-MM-DDTHH:MM.
export const DEFAULT_WEDDING = {
  couple: ["Laveen", "Anoushka"],
  dateLabel: "22 – 24 . 01 . 2027",
  timesConfirmed: false,
  venue: {
    name: "Palm Springs Resort",
    city: "Nashik",
    landmark: "Near Sula Vineyards",
    mapsQuery: "Palm Springs Resort Nashik",
    mapsUrl: "",
    facts: [
      ["Check-in", "Fri 22 Jan 2027, 12 noon onwards"],
      ["Check-out", "Mon 25 Jan 2027, 12 noon"],
      ["From Nashik (Ozar) Airport", "30 km"],
      ["From Nashik Road Railway Station", "18 km"],
      ["Local Nashik address", "28 Sinnar Sankul, Yeolekar Mala, College Road, Nashik"]
    ]
  },
  contacts: [
    ["Bride's side", "+91 94032 75840"],
    ["Groom's side", "+91 62626 29162"],
    ["Local contact, Nashik", "+91 85509 92518"]
  ],
  events: [
    { id: "cocktail", name: "Cocktail", start: "2027-01-22T19:30", end: "2027-01-22T23:30", spot: "Venue spot to be confirmed",
      dress: "Deep Jewel Tones", colors: [["Ruby", "#9b111e"], ["Black", "#111111"], ["Midnight Blue", "#191970"], ["Emerald", "#046307"]] },
    { id: "carnival", name: "Carnival", start: "2027-01-23T11:00", end: "2027-01-23T14:30", spot: "Venue spot to be confirmed",
      dress: "Pastels & Florals", colors: [["Soft Mint", "#bfe8d4"], ["Lilac", "#c8a2c8"], ["Butter Yellow", "#f6e7a1"], ["Blush Pink", "#f4c2c2"]] },
    { id: "wedding", name: "Wedding", start: "2027-01-23T18:00", end: "2027-01-23T22:30", spot: "Venue spot to be confirmed",
      dress: "Ivory, Gold & Earthy Tones", colors: [["Gold", "#c9a227"], ["Ivory", "#fffff0"], ["Beige", "#d9c7a3"], ["Teal", "#1f6f6f"], ["Brown", "#6b4423"]] },
    { id: "reception", name: "Reception", start: "2027-01-24T19:30", end: "2027-01-24T23:30", spot: "Venue spot to be confirmed",
      dress: "Black-Tie & Champagne", colors: [["Rose Gold", "#b76e79"], ["Copper", "#b87333"], ["Champagne", "#f1ddb8"]] }
  ]
};

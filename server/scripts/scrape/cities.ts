import type { CityConfig } from './types.js';

// All source ids below were resolved against the live services:
// - European set on 2026-07-08, worldwide expansion on 2026-07-10.
// - lumaPlaceId: scraped from https://luma.com/<slug> (discplace-… in the HTML);
//   null where lu.ma has no city page (redirects to /discover). lu.ma is not
//   scraped anymore (free signups, not tickets), so new cities stay null.
// - raAreaId: from RA's GraphQL `areas(searchTerm:)` (exact name match).
//   Some RA areas are metro-wide by construction (San Francisco/Oakland,
//   Dallas/Fort Worth, Minneapolis/St Paul) — accepted: they are RA's own
//   city-level granularity for those markets.
// - eventbriteSlug: /d/<slug>/ pages verified to return real SERVER_DATA
//   results on eventbrite.com (probed with a live search term); null where
//   the slug 404s or returns zero results (localized-domain-only markets:
//   Brazil, Chile, Japan ex-Tokyo/Kyoto, China, Indonesia, Israel, Turkey,
//   Russia).
// - eventbriteCityAliases: extra venue-city spellings accepted by the
//   Eventbrite venue-city-must-match check, only where Eventbrite's venue
//   city differs from the canonical app name (accents, boroughs, "Washington"
//   for Washington DC …). Never used to widen a city into its suburbs.
//
// Cairo is deliberately absent: RA has no Cairo area (only country-wide
// "Egypt", which would mislabel El Gouna/Alexandria events as Cairo) and the
// eventbrite.com slug 404s — no clean source, so no config.
export const CITIES: CityConfig[] = [
  // --- Europe ---
  { name: 'London',     timeZone: 'Europe/London',     lumaPlaceId: 'discplace-QCcNk3HXowOR97j', raAreaId: 13,  eventbriteSlug: 'united-kingdom--london',  alleventsSlug: 'london' },
  { name: 'Paris',      timeZone: 'Europe/Paris',      lumaPlaceId: 'discplace-NdLrh1xJfeotJZC', raAreaId: 44,  eventbriteSlug: 'france--paris',           alleventsSlug: 'paris' },
  { name: 'Berlin',     timeZone: 'Europe/Berlin',     lumaPlaceId: 'discplace-gCfX0s3E9Hgo3rG', raAreaId: 34,  eventbriteSlug: 'germany--berlin',         alleventsSlug: 'berlin' },
  { name: 'Munich',     timeZone: 'Europe/Berlin',     lumaPlaceId: 'discplace-P00kEGGGHNLEYGe', raAreaId: 151, eventbriteSlug: null,                      alleventsSlug: 'munich' },
  { name: 'Hamburg',    timeZone: 'Europe/Berlin',     lumaPlaceId: 'discplace-xZzD6rDcDK12oi7', raAreaId: 148, eventbriteSlug: 'germany--hamburg',        alleventsSlug: 'hamburg' },
  { name: 'Cologne',    timeZone: 'Europe/Berlin',     lumaPlaceId: null,                        raAreaId: 143, eventbriteSlug: null,                      alleventsSlug: 'cologne' },
  { name: 'Frankfurt',  timeZone: 'Europe/Berlin',     lumaPlaceId: null,                        raAreaId: 147, eventbriteSlug: 'germany--frankfurt',      alleventsSlug: 'frankfurt' },
  { name: 'Vienna',     timeZone: 'Europe/Vienna',     lumaPlaceId: 'discplace-3YgdIjqj7Pveid3', raAreaId: 450, eventbriteSlug: null,                      alleventsSlug: 'vienna' },
  { name: 'Zurich',     timeZone: 'Europe/Zurich',     lumaPlaceId: 'discplace-tSRc3NkTycobe0w', raAreaId: 390, eventbriteSlug: null,                      alleventsSlug: 'zurich' },
  { name: 'Geneva',     timeZone: 'Europe/Zurich',     lumaPlaceId: null,                        raAreaId: 392, eventbriteSlug: 'switzerland--geneva',     alleventsSlug: null, eventbriteCityAliases: ['genève'] },
  { name: 'Amsterdam',  timeZone: 'Europe/Amsterdam',  lumaPlaceId: 'discplace-FC4SDMUVXiFtMOr', raAreaId: 29,  eventbriteSlug: 'netherlands--amsterdam',  alleventsSlug: 'amsterdam' },
  { name: 'Brussels',   timeZone: 'Europe/Brussels',   lumaPlaceId: 'discplace-CMxOe3Mv06uUk7l', raAreaId: 405, eventbriteSlug: null,                      alleventsSlug: 'brussels' },
  { name: 'Madrid',     timeZone: 'Europe/Madrid',     lumaPlaceId: 'discplace-03jiEcS4mvwJuDa', raAreaId: 41,  eventbriteSlug: 'spain--madrid',           alleventsSlug: 'madrid' },
  { name: 'Barcelona',  timeZone: 'Europe/Madrid',     lumaPlaceId: 'discplace-WcS4REeayDPXV4n', raAreaId: 20,  eventbriteSlug: 'spain--barcelona',        alleventsSlug: 'barcelona' },
  { name: 'Lisbon',     timeZone: 'Europe/Lisbon',     lumaPlaceId: 'discplace-mgGFFo5EDdyekyE', raAreaId: 53,  eventbriteSlug: null,                      alleventsSlug: 'lisbon' },
  { name: 'Rome',       timeZone: 'Europe/Rome',       lumaPlaceId: 'discplace-CLGg2G8Q96daz0w', raAreaId: 351, eventbriteSlug: null,                      alleventsSlug: 'rome' },
  { name: 'Milan',      timeZone: 'Europe/Rome',       lumaPlaceId: 'discplace-9AyCYUvGH7xiqhh', raAreaId: 347, eventbriteSlug: null,                      alleventsSlug: 'milan' },
  { name: 'Copenhagen', timeZone: 'Europe/Copenhagen', lumaPlaceId: 'discplace-CmmHAjPdBSsqmJf', raAreaId: 402, eventbriteSlug: 'denmark--copenhagen',     alleventsSlug: 'copenhagen' },
  { name: 'Stockholm',  timeZone: 'Europe/Stockholm',  lumaPlaceId: 'discplace-e7EG0Ef6S2aQnvN', raAreaId: 396, eventbriteSlug: 'sweden--stockholm',       alleventsSlug: 'stockholm' },
  { name: 'Oslo',       timeZone: 'Europe/Oslo',       lumaPlaceId: 'discplace-Q5DXX8la0vuCuz2', raAreaId: 408, eventbriteSlug: 'norway--oslo',            alleventsSlug: 'oslo' },
  { name: 'Helsinki',   timeZone: 'Europe/Helsinki',   lumaPlaceId: null,                        raAreaId: 407, eventbriteSlug: 'finland--helsinki',       alleventsSlug: null },
  { name: 'Prague',     timeZone: 'Europe/Prague',     lumaPlaceId: 'discplace-6xx9LRci5NFgdJ5', raAreaId: 451, eventbriteSlug: 'czech-republic--prague',  alleventsSlug: 'prague' },
  { name: 'Warsaw',     timeZone: 'Europe/Warsaw',     lumaPlaceId: 'discplace-PTcuEQVHuySJe8N', raAreaId: 454, eventbriteSlug: null,                      alleventsSlug: 'warsaw' },
  { name: 'Budapest',   timeZone: 'Europe/Budapest',   lumaPlaceId: 'discplace-zS3rBqHSdNGTSZB', raAreaId: 449, eventbriteSlug: 'hungary--budapest',       alleventsSlug: 'budapest' },
  { name: 'Dublin',     timeZone: 'Europe/Dublin',     lumaPlaceId: 'discplace-ffI8KmAB4gC5LMC', raAreaId: 386, eventbriteSlug: 'ireland--dublin',         alleventsSlug: 'dublin' },
  { name: 'Athens',     timeZone: 'Europe/Athens',     lumaPlaceId: null,                        raAreaId: 549, eventbriteSlug: null,                      alleventsSlug: 'athens' },
  { name: 'Istanbul',   timeZone: 'Europe/Istanbul',   lumaPlaceId: null,                        raAreaId: 73,  eventbriteSlug: null,                      alleventsSlug: null },
  { name: 'Moscow',     timeZone: 'Europe/Moscow',     lumaPlaceId: null,                        raAreaId: 88,  eventbriteSlug: null,                      alleventsSlug: null },

  // --- North America: United States ---
  { name: 'New York',      timeZone: 'America/New_York',    lumaPlaceId: null, raAreaId: 8,   eventbriteSlug: 'ny--new-york',      alleventsSlug: null, eventbriteCityAliases: ['new york city', 'brooklyn', 'queens', 'bronx', 'staten island'] },
  { name: 'Los Angeles',   timeZone: 'America/Los_Angeles', lumaPlaceId: null, raAreaId: 23,  eventbriteSlug: 'ca--los-angeles',   alleventsSlug: null },
  { name: 'San Francisco', timeZone: 'America/Los_Angeles', lumaPlaceId: null, raAreaId: 218, eventbriteSlug: 'ca--san-francisco', alleventsSlug: null },
  { name: 'San Diego',     timeZone: 'America/Los_Angeles', lumaPlaceId: null, raAreaId: 309, eventbriteSlug: 'ca--san-diego',     alleventsSlug: null },
  { name: 'Seattle',       timeZone: 'America/Los_Angeles', lumaPlaceId: null, raAreaId: 46,  eventbriteSlug: 'wa--seattle',       alleventsSlug: null },
  { name: 'Portland',      timeZone: 'America/Los_Angeles', lumaPlaceId: null, raAreaId: 125, eventbriteSlug: 'or--portland',      alleventsSlug: null },
  { name: 'Las Vegas',     timeZone: 'America/Los_Angeles', lumaPlaceId: null, raAreaId: 527, eventbriteSlug: 'nv--las-vegas',     alleventsSlug: null },
  { name: 'Phoenix',       timeZone: 'America/Phoenix',     lumaPlaceId: null, raAreaId: 591, eventbriteSlug: 'az--phoenix',       alleventsSlug: null },
  { name: 'Denver',        timeZone: 'America/Denver',      lumaPlaceId: null, raAreaId: 519, eventbriteSlug: 'co--denver',        alleventsSlug: null },
  { name: 'Chicago',       timeZone: 'America/Chicago',     lumaPlaceId: null, raAreaId: 17,  eventbriteSlug: 'il--chicago',       alleventsSlug: null },
  { name: 'Minneapolis',   timeZone: 'America/Chicago',     lumaPlaceId: null, raAreaId: 590, eventbriteSlug: 'mn--minneapolis',   alleventsSlug: null },
  { name: 'Austin',        timeZone: 'America/Chicago',     lumaPlaceId: null, raAreaId: 321, eventbriteSlug: 'tx--austin',        alleventsSlug: null },
  { name: 'Dallas',        timeZone: 'America/Chicago',     lumaPlaceId: null, raAreaId: 319, eventbriteSlug: 'tx--dallas',        alleventsSlug: null },
  { name: 'Houston',       timeZone: 'America/Chicago',     lumaPlaceId: null, raAreaId: 63,  eventbriteSlug: 'tx--houston',       alleventsSlug: null },
  { name: 'Nashville',     timeZone: 'America/Chicago',     lumaPlaceId: null, raAreaId: 653, eventbriteSlug: 'tn--nashville',     alleventsSlug: null },
  { name: 'New Orleans',   timeZone: 'America/Chicago',     lumaPlaceId: null, raAreaId: 606, eventbriteSlug: 'la--new-orleans',   alleventsSlug: null },
  { name: 'Detroit',       timeZone: 'America/Detroit',     lumaPlaceId: null, raAreaId: 19,  eventbriteSlug: 'mi--detroit',       alleventsSlug: null },
  { name: 'Boston',        timeZone: 'America/New_York',    lumaPlaceId: null, raAreaId: 530, eventbriteSlug: 'ma--boston',        alleventsSlug: null },
  { name: 'Philadelphia',  timeZone: 'America/New_York',    lumaPlaceId: null, raAreaId: 528, eventbriteSlug: 'pa--philadelphia',  alleventsSlug: null },
  { name: 'Washington DC', timeZone: 'America/New_York',    lumaPlaceId: null, raAreaId: 22,  eventbriteSlug: 'dc--washington',    alleventsSlug: null, eventbriteCityAliases: ['washington'] },
  { name: 'Atlanta',       timeZone: 'America/New_York',    lumaPlaceId: null, raAreaId: 532, eventbriteSlug: 'ga--atlanta',       alleventsSlug: null },
  { name: 'Miami',         timeZone: 'America/New_York',    lumaPlaceId: null, raAreaId: 38,  eventbriteSlug: 'fl--miami',         alleventsSlug: null, eventbriteCityAliases: ['miami beach'] },

  // --- North America: Canada & Mexico ---
  { name: 'Toronto',     timeZone: 'America/Toronto',     lumaPlaceId: null, raAreaId: 28,  eventbriteSlug: 'canada--toronto',    alleventsSlug: null },
  { name: 'Montreal',    timeZone: 'America/Toronto',     lumaPlaceId: null, raAreaId: 40,  eventbriteSlug: 'canada--montreal',   alleventsSlug: null, eventbriteCityAliases: ['montréal'] },
  { name: 'Vancouver',   timeZone: 'America/Vancouver',   lumaPlaceId: null, raAreaId: 39,  eventbriteSlug: 'canada--vancouver',  alleventsSlug: null },
  { name: 'Mexico City', timeZone: 'America/Mexico_City', lumaPlaceId: null, raAreaId: 399, eventbriteSlug: 'mexico--mexico-city', alleventsSlug: null, eventbriteCityAliases: ['ciudad de méxico', 'cdmx'] },

  // --- South America ---
  { name: 'Bogotá',         timeZone: 'America/Bogota',                lumaPlaceId: null, raAreaId: 373, eventbriteSlug: 'colombia--bogota',        alleventsSlug: null, eventbriteCityAliases: ['bogota'] },
  { name: 'Buenos Aires',   timeZone: 'America/Argentina/Buenos_Aires', lumaPlaceId: null, raAreaId: 395, eventbriteSlug: 'argentina--buenos-aires', alleventsSlug: null },
  { name: 'Santiago',       timeZone: 'America/Santiago',              lumaPlaceId: null, raAreaId: 385, eventbriteSlug: null,                      alleventsSlug: null },
  { name: 'São Paulo',      timeZone: 'America/Sao_Paulo',             lumaPlaceId: null, raAreaId: 400, eventbriteSlug: null,                      alleventsSlug: null },
  { name: 'Rio de Janeiro', timeZone: 'America/Sao_Paulo',             lumaPlaceId: null, raAreaId: 401, eventbriteSlug: null,                      alleventsSlug: null },

  // --- Asia ---
  { name: 'Tokyo',     timeZone: 'Asia/Tokyo',     lumaPlaceId: null, raAreaId: 27,  eventbriteSlug: 'japan--tokyo',         alleventsSlug: null },
  { name: 'Osaka',     timeZone: 'Asia/Tokyo',     lumaPlaceId: null, raAreaId: 664, eventbriteSlug: null,                   alleventsSlug: null },
  { name: 'Kyoto',     timeZone: 'Asia/Tokyo',     lumaPlaceId: null, raAreaId: 663, eventbriteSlug: 'japan--kyoto',         alleventsSlug: null },
  { name: 'Seoul',     timeZone: 'Asia/Seoul',     lumaPlaceId: null, raAreaId: 537, eventbriteSlug: 'south-korea--seoul',   alleventsSlug: null },
  { name: 'Hong Kong', timeZone: 'Asia/Hong_Kong', lumaPlaceId: null, raAreaId: 71,  eventbriteSlug: 'hong-kong--hong-kong', alleventsSlug: null },
  { name: 'Taipei',    timeZone: 'Asia/Taipei',    lumaPlaceId: null, raAreaId: 412, eventbriteSlug: 'taiwan--taipei',       alleventsSlug: null },
  { name: 'Shanghai',  timeZone: 'Asia/Shanghai',  lumaPlaceId: null, raAreaId: 68,  eventbriteSlug: null,                   alleventsSlug: null },
  { name: 'Beijing',   timeZone: 'Asia/Shanghai',  lumaPlaceId: null, raAreaId: 191, eventbriteSlug: null,                   alleventsSlug: null },
  { name: 'Singapore', timeZone: 'Asia/Singapore', lumaPlaceId: null, raAreaId: 51,  eventbriteSlug: 'singapore--singapore', alleventsSlug: null },
  { name: 'Bangkok',   timeZone: 'Asia/Bangkok',   lumaPlaceId: null, raAreaId: 453, eventbriteSlug: 'thailand--bangkok',    alleventsSlug: null },
  { name: 'Jakarta',   timeZone: 'Asia/Jakarta',   lumaPlaceId: null, raAreaId: 569, eventbriteSlug: null,                   alleventsSlug: null },
  { name: 'Manila',    timeZone: 'Asia/Manila',    lumaPlaceId: null, raAreaId: 565, eventbriteSlug: 'philippines--manila',  alleventsSlug: null },
  { name: 'Delhi',     timeZone: 'Asia/Kolkata',   lumaPlaceId: null, raAreaId: 324, eventbriteSlug: 'india--new-delhi',     alleventsSlug: null, eventbriteCityAliases: ['new delhi'] },
  { name: 'Mumbai',    timeZone: 'Asia/Kolkata',   lumaPlaceId: null, raAreaId: 328, eventbriteSlug: 'india--mumbai',        alleventsSlug: null },

  // --- Middle East & Africa ---
  { name: 'Dubai',        timeZone: 'Asia/Dubai',          lumaPlaceId: null, raAreaId: 136, eventbriteSlug: 'united-arab-emirates--dubai', alleventsSlug: null },
  { name: 'Tel Aviv',     timeZone: 'Asia/Jerusalem',      lumaPlaceId: null, raAreaId: 413, eventbriteSlug: null,                          alleventsSlug: null },
  { name: 'Cape Town',    timeZone: 'Africa/Johannesburg', lumaPlaceId: null, raAreaId: 100, eventbriteSlug: 'south-africa--cape-town',     alleventsSlug: null },
  { name: 'Johannesburg', timeZone: 'Africa/Johannesburg', lumaPlaceId: null, raAreaId: 258, eventbriteSlug: 'south-africa--johannesburg',  alleventsSlug: null },
  { name: 'Nairobi',      timeZone: 'Africa/Nairobi',      lumaPlaceId: null, raAreaId: 660, eventbriteSlug: 'kenya--nairobi',              alleventsSlug: null },
  { name: 'Lagos',        timeZone: 'Africa/Lagos',        lumaPlaceId: null, raAreaId: 557, eventbriteSlug: 'nigeria--lagos',              alleventsSlug: null },

  // --- Oceania ---
  { name: 'Sydney',    timeZone: 'Australia/Sydney',    lumaPlaceId: null, raAreaId: 1, eventbriteSlug: 'australia--sydney',    alleventsSlug: null },
  { name: 'Melbourne', timeZone: 'Australia/Melbourne', lumaPlaceId: null, raAreaId: 2, eventbriteSlug: 'australia--melbourne', alleventsSlug: null },
];

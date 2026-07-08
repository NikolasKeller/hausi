import type { CityConfig } from './types.js';

// All source ids below were resolved against the live services on 2026-07-08:
// - lumaPlaceId: scraped from https://luma.com/<slug> (discplace-… in the HTML);
//   null where lu.ma has no city page (redirects to /discover).
// - raAreaId: from RA's GraphQL `areas(searchTerm:)` (exact name match).
// - eventbriteSlug: /d/<slug>/ pages that actually return SERVER_DATA results
//   on eventbrite.com; null where the slug 404s (localized-domain-only cities).
export const CITIES: CityConfig[] = [
  { name: 'London',     timeZone: 'Europe/London',     lumaPlaceId: 'discplace-QCcNk3HXowOR97j', raAreaId: 13,  eventbriteSlug: 'united-kingdom--london',  alleventsSlug: 'london' },
  { name: 'Paris',      timeZone: 'Europe/Paris',      lumaPlaceId: 'discplace-NdLrh1xJfeotJZC', raAreaId: 44,  eventbriteSlug: 'france--paris',           alleventsSlug: 'paris' },
  { name: 'Berlin',     timeZone: 'Europe/Berlin',     lumaPlaceId: 'discplace-gCfX0s3E9Hgo3rG', raAreaId: 34,  eventbriteSlug: 'germany--berlin',         alleventsSlug: 'berlin' },
  { name: 'Munich',     timeZone: 'Europe/Berlin',     lumaPlaceId: 'discplace-P00kEGGGHNLEYGe', raAreaId: 151, eventbriteSlug: null,                      alleventsSlug: 'munich' },
  { name: 'Hamburg',    timeZone: 'Europe/Berlin',     lumaPlaceId: 'discplace-xZzD6rDcDK12oi7', raAreaId: 148, eventbriteSlug: 'germany--hamburg',        alleventsSlug: 'hamburg' },
  { name: 'Cologne',    timeZone: 'Europe/Berlin',     lumaPlaceId: null,                        raAreaId: 143, eventbriteSlug: null,                      alleventsSlug: 'cologne' },
  { name: 'Frankfurt',  timeZone: 'Europe/Berlin',     lumaPlaceId: null,                        raAreaId: 147, eventbriteSlug: 'germany--frankfurt',      alleventsSlug: 'frankfurt' },
  { name: 'Vienna',     timeZone: 'Europe/Vienna',     lumaPlaceId: 'discplace-3YgdIjqj7Pveid3', raAreaId: 450, eventbriteSlug: null,                      alleventsSlug: 'vienna' },
  { name: 'Zurich',     timeZone: 'Europe/Zurich',     lumaPlaceId: 'discplace-tSRc3NkTycobe0w', raAreaId: 390, eventbriteSlug: null,                      alleventsSlug: 'zurich' },
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
  { name: 'Prague',     timeZone: 'Europe/Prague',     lumaPlaceId: 'discplace-6xx9LRci5NFgdJ5', raAreaId: 451, eventbriteSlug: 'czech-republic--prague',  alleventsSlug: 'prague' },
  { name: 'Warsaw',     timeZone: 'Europe/Warsaw',     lumaPlaceId: 'discplace-PTcuEQVHuySJe8N', raAreaId: 454, eventbriteSlug: null,                      alleventsSlug: 'warsaw' },
  { name: 'Budapest',   timeZone: 'Europe/Budapest',   lumaPlaceId: 'discplace-zS3rBqHSdNGTSZB', raAreaId: 449, eventbriteSlug: 'hungary--budapest',       alleventsSlug: 'budapest' },
  { name: 'Dublin',     timeZone: 'Europe/Dublin',     lumaPlaceId: 'discplace-ffI8KmAB4gC5LMC', raAreaId: 386, eventbriteSlug: 'ireland--dublin',         alleventsSlug: 'dublin' },
  { name: 'Athens',     timeZone: 'Europe/Athens',     lumaPlaceId: null,                        raAreaId: 549, eventbriteSlug: null,                      alleventsSlug: 'athens' },
];

const DELIVERY_ZONE = Object.freeze({
  INTERNAL_CITY: "INTERNAL_CITY",
  HCM_SUBURBAN: "HCM_SUBURBAN",
  OUTSIDE_HCM: "OUTSIDE_HCM"
});

const HCM_PROVINCE_ID = 202;

const INTERNAL_CITY_DISTRICT_IDS = new Set([
  1442,
  1443,
  1444,
  1446,
  1447,
  1448,
  1449,
  1450,
  1451,
  1452,
  1453,
  1454,
  1455,
  1456,
  1457,
  1458,
  1461,
  1462,
  1463,
  3695
]);

function isHoChiMinh(provinceId) {
  return Number(provinceId) === HCM_PROVINCE_ID;
}

function isInternalCityHcm(districtId) {
  return INTERNAL_CITY_DISTRICT_IDS.has(Number(districtId));
}

function resolveShippingZone({ provinceId, districtId } = {}) {
  if (!isHoChiMinh(provinceId)) {
    return DELIVERY_ZONE.OUTSIDE_HCM;
  }

  return isInternalCityHcm(districtId)
    ? DELIVERY_ZONE.INTERNAL_CITY
    : DELIVERY_ZONE.HCM_SUBURBAN;
}

module.exports = {
  DELIVERY_ZONE,
  HCM_PROVINCE_ID,
  INTERNAL_CITY_DISTRICT_IDS,
  resolveShippingZone,
  isHoChiMinh,
  isInternalCityHcm
};

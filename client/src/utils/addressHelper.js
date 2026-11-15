const SAVED_LOCATION_KEY = 'savedShippingLocation';

export function getSavedShippingLocation() {
    try {
        const raw = localStorage.getItem(SAVED_LOCATION_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function setSavedShippingLocation(location) {
    try {
        if (!location) {
            localStorage.removeItem(SAVED_LOCATION_KEY);
            return;
        }
        localStorage.setItem(SAVED_LOCATION_KEY, JSON.stringify(location));
    } catch {
        return;
    }
}

export function composeFullAddress(street, wardName, districtName, provinceName) {
    const parts = [
        street ? String(street).trim() : '',
        wardName ? String(wardName).trim() : '',
        districtName ? String(districtName).trim() : '',
        provinceName ? String(provinceName).trim() : ''
    ].filter(Boolean);
    return parts.join(', ');
}

export async function resolveAddressToGhn(rawAddr, provinceList, shippingService) {
    if (!rawAddr || !provinceList || provinceList.length === 0 || !shippingService) {
        return null;
    }

    const addrLower = String(rawAddr).toLowerCase();

    let prov = provinceList.find((p) => {
        const pName = (p.provinceName || '').toLowerCase().replace(/^(tỉnh|thành phố|tp\.?)\s+/i, '').trim();
        return pName && addrLower.includes(pName);
    });

    if (!prov && (addrLower.includes('hồ chí minh') || addrLower.includes('hcm') || addrLower.includes('thủ đức') || addrLower.includes('sài gòn'))) {
        prov = provinceList.find((p) => Number(p.provinceId) === 202);
    }

    if (!prov) {
        return null;
    }

    try {
        const distRes = await shippingService.getDistricts(prov.provinceId);
        const distArray = Array.isArray(distRes?.data) ? distRes.data : (Array.isArray(distRes) ? distRes : []);
        if (distArray.length === 0) {
            return {
                provinceId: prov.provinceId,
                provinceName: prov.provinceName
            };
        }

        const sortedDists = [...distArray].sort((a, b) => (b.districtName || '').length - (a.districtName || '').length);
        const dist = sortedDists.find((d) => {
            const rawName = (d.districtName || '').toLowerCase();
            const cleanName = rawName.replace(/^(quận|huyện|thành phố|thị xã)\s+/i, '').trim();
            if (/^\d+$/.test(cleanName)) {
                return addrLower.includes(rawName) || addrLower.includes(`q.${cleanName}`) || addrLower.includes(`q${cleanName}`);
            }
            return cleanName && addrLower.includes(cleanName);
        });

        if (!dist) {
            return {
                provinceId: prov.provinceId,
                provinceName: prov.provinceName
            };
        }

        const wardRes = await shippingService.getWards(dist.districtId);
        const wardArray = Array.isArray(wardRes?.data) ? wardRes.data : (Array.isArray(wardRes) ? wardRes : []);
        const sortedWards = [...wardArray].sort((a, b) => (b.wardName || '').length - (a.wardName || '').length);

        const ward = sortedWards.find((w) => {
            const rawName = (w.wardName || '').toLowerCase();
            const cleanName = rawName.replace(/^(phường|xã|thị trấn)\s+/i, '').trim();
            if (/^\d+$/.test(cleanName)) {
                return addrLower.includes(rawName) || addrLower.includes(`p.${cleanName}`) || addrLower.includes(`p${cleanName}`);
            }
            return cleanName && addrLower.includes(cleanName);
        });

        const parts = rawAddr.split(',').map((s) => s.trim());
        const street = parts.length > 1 ? parts[0] : '';

        return {
            provinceId: prov.provinceId,
            provinceName: prov.provinceName,
            districtId: dist.districtId,
            districtName: dist.districtName,
            wardCode: ward ? String(ward.wardCode) : undefined,
            wardName: ward ? ward.wardName : undefined,
            streetAddress: street,
            fullAddress: composeFullAddress(street, ward?.wardName, dist?.districtName, prov?.provinceName)
        };
    } catch {
        return null;
    }
}

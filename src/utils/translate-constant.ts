export async function translateConstant(constant, __) {
    return Object.keys(constant).map(key => ({
        key: constant[key],
        value: __(constant[key])
    }));
}

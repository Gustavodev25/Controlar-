
const desc = "Pag*Steam 1/3";
const match = desc.match(/(\d+)\s*\/\s*(\d+)/);
console.log('Desc:', desc);
console.log('Match:', match);
if (match) {
    console.log('Current:', match[1]);
    console.log('Total:', match[2]);
}

const desc2 = "Pag*Steam1/3";
const match2 = desc2.match(/(\d+)\s*\/\s*(\d+)/);
console.log('Desc2:', desc2);
console.log('Match2:', match2);

const extractInstallmentFromDesc = (desc) => {
    const match = (desc || '').match(/(\d+)\s*\/\s*(\d+)/);
    if (match) {
        const current = parseInt(match[1]);
        const total = parseInt(match[2]);
        if (current > 0 && total > 0 && current <= total) {
            return { current, total };
        }
    }
    return null;
};

console.log('Extract 1:', extractInstallmentFromDesc(desc));

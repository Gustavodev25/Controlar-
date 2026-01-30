const fs = require('fs');

const transactionText = `
28/01/2026	JAN	ANUIDADE DIFERENCIADA	Tarifas cartão	R$ 43,75	Pago
26/01/2026	JAN	IFD*BR	Delivery	R$ 109,07	Pago
26/01/2026	JAN	MERCADINHO TRES DE MAI	Supermercado	R$ 16,00	Pago
26/01/2026	JAN	PPRO *MICROSOFT	Serviços digitais	R$ 60,00	Pago
26/01/2026	JAN	LAVA RAPIDO CAMPEAO	Manutenção Auto	R$ 50,00	Pago
25/01/2026	JAN	DROGARIA SAO PAULO SA	Farmácia	R$ 59,76	Pago
25/01/2026	JAN	APPLE.COM/BILL	Serviços digitais	R$ 69,99	Pago
24/01/2026	JAN	FACEBK *PSS8JC9JP2	Serviços digitais	R$ 100,00	Pago
23/01/2026	JAN	MANZA SUSHI RESTAURANT	Restaurante	R$ 394,35	Pago
23/01/2026	JAN	APPLE.COM/BILL	Serviços digitais	R$ 34,90	Pago
23/01/2026	JAN	ESTACIONAMENTO ROSSINI	Estacionamento	R$ 30,00	Pago
22/01/2026	JAN	Wellhub Gympass BR Wellhu	Academia	R$ 189,90	Pago
22/01/2026	JAN	SUA ACADEMIA	Healthcare	R$ 9,95	Pago
22/01/2026	JAN	PETLOVE SAUD*Petl	Seguros	R$ 35,91	Pago
22/01/2026	JAN	FACEBK *XKBC5ERJP2	Serviços digitais	R$ 100,00	Pago
22/01/2026	JAN	APPLE.COM/BILL	Serviços digitais	R$ 19,90	Pago
22/01/2026	JAN	Amazon Digital BR	Serviços digitais	R$ 27,90	Pago
22/01/2026	JAN	MERCADINHO TRES DE MAI	Supermercado	R$ 1,40	Pago
21/01/2026	JAN	UBER * PENDING	Reembolso	R$ 19,90	Pago
21/01/2026	JAN	FGV AG. VENDAS	Universidade	R$ 2.943,30	Pago
21/01/2026	JAN	FACEBK *RC9JNCDJP2	Reembolso	R$ 100,00	Pago
21/01/2026	JAN	MERCADINHO TRES DE MAI	Supermercado	R$ 30,90	Pago
20/01/2026	JAN	TOP SP TARFA TRANSPORT	Ônibus / metrô	R$ 6,35	Pago
20/01/2026	JAN	TOP SP TARFA TRANSPORT	Reembolso	R$ 14,20	Pago
20/01/2026	JAN	SWEETCO	Reembolso	R$ 6,50	Pago
20/01/2026	JAN	MERCADINHO TRES DE MAI	Supermercado	R$ 27,45	Pago
19/01/2026	JAN	FACEBK *4YZ6QEZHP2	Serviços digitais	R$ 130,00	Pago
19/01/2026	JAN	MERCADINHO TRES DE MAI	Reembolso	R$ 1,40	Pago
19/01/2026	JAN	MERCADINHO TRES DE MAI	Supermercado	R$ 23,30	Pago
18/01/2026	JAN	IFD*BR	Delivery	R$ 20,89	Pago
18/01/2026	JAN	MERCADINHO TRES DE MAI	Reembolso	R$ 2,10	Pago
18/01/2026	JAN	DROGASIL2409	Farmácia	R$ 10,18	Pago
18/01/2026	JAN	DROGASIL2409	Farmácia	R$ 50,73	Pago
17/01/2026	JAN	D C COMERCIO DE FONDUE	Supermercado	R$ 20,64	Pago
17/01/2026	JAN	IFD*BR	Delivery	R$ 60,88	Pago
17/01/2026	JAN	SUCO BAGACO	Restaurante	R$ 19,99	Pago
17/01/2026	JAN	SHOPPING ABC	Compras	R$ 21,50	Pago
17/01/2026	JAN	GALEAO PANIFICADORA E	Supermercado	R$ 51,50	Pago
17/01/2026	JAN	MANIA DE CHURRASCO	Restaurante	R$ 75,80	Pago
17/01/2026	JAN	FACEBK *7QR6QDRJP2	Serviços digitais	R$ 100,00	Pago
16/01/2026	JAN	UBER * PENDING	Táxi / apps	R$ 107,81	Pago
16/01/2026	JAN	SWEETCO	Supermercado	R$ 8,00	Pago
16/01/2026	JAN	TOP SP TARFA TRANSPORT	Reembolso	R$ 14,20	Pago
15/01/2026	JAN	CLARICELL	Serviços	R$ 15,00	Pago
15/01/2026	JAN	AmazonPrimeBR	Serviços digitais	R$ 19,90	Pago
15/01/2026	JAN	CROCCE RESTAURANTE	Restaurante	R$ 131,10	Pago
15/01/2026	JAN	TOP SP TARFA TRANSPORT	Reembolso	R$ 14,20	Pago
15/01/2026	JAN	MORUMBI MAKERS COMEST	Stadiums and arenas	R$ 61,80	Pago
15/01/2026	JAN	SWEETCO	Reembolso	R$ 5,50	Pago
15/01/2026	JAN	FACEBK *5HTYFCVJP2	Reembolso	R$ 200,00	Pago
14/01/2026	JAN	STUDIO METROPOLE PRIME LT	Serviços	R$ 89,00	Pago
14/01/2026	JAN	LOJAS AMERICANAS 75	Food and drinks	R$ 9,99	Pago
14/01/2026	JAN	SWEETCO	Supermercado	R$ 5,50	Pago
14/01/2026	JAN	M.F.D. COMERCIO DE AL	Supermercado	R$ 35,90	Pago
14/01/2026	JAN	SAO BERNARDO	Telecom	R$ 15,00	Pago
14/01/2026	JAN	TOP SP TARFA TRANSPORT	Reembolso	R$ 14,20	Pago
13/01/2026	JAN	DL *UberRides	Táxi / apps	R$ 1,32	Pago
13/01/2026	JAN	MERCADINHO TRES DE MAI	Reembolso	R$ 1,40	Pago
13/01/2026	JAN	ASA*CONTROLAR MAIS LTD	Serviços digitais	R$ 9,90	Pago
13/01/2026	JAN	MERCADINHO TRES DE MAI	Supermercado	R$ 13,60	Pago
13/01/2026	JAN	SEM PARAR	Pedágios	R$ 50,00	Pago
13/01/2026	JAN	SUPERMERCADO FLAQUER L	Supermercado	R$ 53,35	Pago
12/01/2026	JAN	SCP MAIS- JAN/26	Seguros	R$ 16,45	Pago
12/01/2026	JAN	MERCADINHO TRES DE MAI	Reembolso	R$ 4,40	Pago
12/01/2026	JAN	MERCADINHO TRES DE MAI	Supermercado	R$ 26,30	Pago
12/01/2026	JAN	MERCADINHO TRES DE MAI	Supermercado	R$ 4,00	Pago
11/01/2026	JAN	MERCADINHO TRES DE MAI	Supermercado	R$ 1,40	Pago
11/01/2026	JAN	FACEBK *MQ5KEDMJP2	Reembolso	R$ 150,00	Pago
11/01/2026	JAN	MARRACOMPANY	Serviços digitais	R$ 79,00	Pago
10/01/2026	JAN	MERCADOLIVRE*MERCADOLIVRE	Serviços	R$ 66,74	Pago
10/01/2026	JAN	3 cartoes 1UOID9	Estacionamento	R$ 1,50	Pago
10/01/2026	JAN	2 cartoes 1UOSFJ	Estacionamento	R$ 1,00	Pago
10/01/2026	JAN	MP*DAMISBAR	Compras	R$ 21,00	Pago
10/01/2026	JAN	3 cartoes 1UP8IK	Estacionamento	R$ 2,16	Pago
10/01/2026	JAN	MERCADINHO TRES DE MAI	Supermercado	R$ 29,10	Pago
10/01/2026	JAN	BARBOSA LOJA 42	Supermercado	R$ 34,74	Pago
09/01/2026	JAN	TOP SP TARFA TRANSPORT	Reembolso	R$ 14,20	Pago
09/01/2026	JAN	HOUS COFFEE	Restaurante	R$ 40,30	Pago
09/01/2026	JAN	DROGASIL	Farmácia	R$ 105,85	Pago
09/01/2026	JAN	SWEETCO	Reembolso	R$ 6,00	Pago
09/01/2026	JAN	MERCADINHO TRES DE MAI	Supermercado	R$ 12,40	Pago
09/01/2026	JAN	BRASA BAR CHOPP	Restaurante	R$ 176,96	Pago
09/01/2026	JAN	APPLE.COM/BILL	Serviços digitais	R$ 39,90	Pago
08/01/2026	JAN	LINKER LTDA	Restaurante	R$ 15,00	Pago
08/01/2026	JAN	SWEETCO	Supermercado	R$ 5,00	Pago
08/01/2026	JAN	SWEETCO	Supermercado	R$ 6,00	Pago
08/01/2026	JAN	FACEBK *ADD6ACVHP2	Serviços digitais	R$ 220,00	Pago
08/01/2026	JAN	TOP SP TARFA TRANSPORT	Reembolso	R$ 14,20	Pago
08/01/2026	JAN	UBER * PENDING	Táxi / apps	R$ 106,07	Pago
08/01/2026	JAN	MARRACOMPANY	Serviços digitais	R$ 30,00	Pago
08/01/2026	JAN	MERCADINHO TRES DE MAI	Supermercado	R$ 4,40	Pago
08/01/2026	JAN	SWEETCO	Supermercado	R$ 6,50	Pago
07/01/2026	JAN	SWEETCO	Supermercado	R$ 9,00	Pago
07/01/2026	JAN	IFD*BR	Delivery	R$ 5,95	Pago
07/01/2026	JAN	TOP SP TARFA TRANSPORT	Reembolso	R$ 14,20	Pago
07/01/2026	JAN	SWEETCO	Supermercado	R$ 12,00	Pago
07/01/2026	JAN	Amazon Prime Canais	Serviços digitais	R$ 29,90	Pago
07/01/2026	JAN	EMPORIO TC	Supermercado	R$ 48,66	Pago
06/01/2026	JAN	FACEBK *WJ2F3B9JP2	Serviços digitais	R$ 200,00	Pago
06/01/2026	JAN	HOTEL MATIZ MULTI SUIT	Hospedagem	R$ 772,72	Pago
06/01/2026	JAN	TKT360*SUUE	Reembolso	- R$ 359,20	Pago
06/01/2026	JAN	MERCADINHO TRES DE MAI	Supermercado	R$ 2,10	Pago
05/01/2026	JAN	Smiles Clube Smiles	Milhas	R$ 46,00	Pago
05/01/2026	JAN	MERCADINHO TRES DE MAI	Supermercado	R$ 31,05	Pago
05/01/2026	JAN	ESTACIONAMENTO QUELH	Estacionamento	R$ 30,00	Pago
04/01/2026	JAN	FACEBK *QLCKHDZHP2	Serviços digitais	R$ 150,00	Pago
04/01/2026	JAN	MERCADINHO TRES DE MAI	Supermercado	R$ 35,50	Pago
04/01/2026	JAN	99Food *McDonalds - Shopp	Delivery	R$ 46,66	Pago
04/01/2026	JAN	NET PGT*Fatura Claro	Telecom	R$ 565,18	Pago
03/01/2026	JAN	SUPERMERCADO FLAQUER L	Supermercado	R$ 92,16	Pago
03/01/2026	JAN	ASSAI ATACADISTA LJ10	Supermercado	R$ 199,72	Pago
03/01/2026	JAN	MERCADINHO TRES DE MAI	Supermercado	R$ 25,80	Pago
03/01/2026	JAN	MERCADINHO TRES DE MAI	Supermercado	R$ 18,50	Pago
02/01/2026	JAN	ESTACIONAMENTO QUELH	Estacionamento	R$ 7,00	Pago
02/01/2026	JAN	FACEBK *LUXBNBHJP2	Serviços digitais	R$ 72,00	Pago
02/01/2026	JAN	2 cartoes 1U6910	Estacionamento	R$ 2,00	Pago
02/01/2026	JAN	FACEBK *8CFAMBHJP2	Serviços digitais	R$ 50,00	Pago
02/01/2026	JAN	AUTO P SETE ESTRELAS	Combustível	R$ 50,00	Pago
02/01/2026	JAN	IFD*BR	Delivery	R$ 112,79	Pago
31/12/2025	JAN	SEM PARAR	Reembolso	R$ 50,00	Pago
31/12/2025	JAN	OXXO OTO MANEIRA	Supermercado	R$ 27,47	Pago
31/12/2025	JAN	MP*LOTERIASONLINEYVXU	Jogos / Apostas	R$ 49,00	Pago
31/12/2025	JAN	FelipeFundador	Supermercado	R$ 25,00	Pago
31/12/2025	JAN	DROGARIA SAO PAULO 216	Farmácia	R$ 53,58	Pago
31/12/2025	JAN	POSTO QUINTA DO MARQUE	Combustível	R$ 50,00	Pago
31/12/2025	JAN	Amazon Ad free for PrimeV	Reembolso	R$ 10,00	Pago
31/12/2025	JAN	DROGARIA SAO PAULO 216	Farmácia	R$ 16,58	Pago
30/12/2025	JAN	SEM PARAR	Reembolso	R$ 50,00	Pago
30/12/2025	JAN	FACEBK *KLLBXADJP2	Serviços digitais	R$ 252,99	Pago
30/12/2025	JAN	NOBLESSE CAFETERIA	Restaurante	R$ 82,80	Pago
30/12/2025	JAN	EMPORIO DAS ESTRELAS	Supermercado	R$ 17,24	Pago
30/12/2025	JAN	PETLOVE SAUD*Petl	Reembolso	R$ 39,90	Pago
29/12/2025	JAN	EMPORIO DAS ESTRELAS	Supermercado	R$ 16,30	Pago
29/12/2025	JAN	MODA MUNDIAL*SHEI	Compras	R$ 16,99	Pago
29/12/2025	JAN	MULTI DROGAS II	Farmácia	R$ 29,90	Pago
29/12/2025	JAN	MODA MUNDIAL*SHEI	Compras	R$ 363,40	Pago
28/12/2025	JAN	APPLE.COM/BILL	Reembolso	R$ 9,99	Pago
28/12/2025	JAN	EMPORIO DAS ESTRELAS	Supermercado	R$ 30,15	Pago
27/12/2025	JAN	IFD*BR	Delivery	R$ 12,90	Pago
27/12/2025	JAN	SUPERMERCADO FLAQUER L	Supermercado	R$ 48,35	Pago
27/12/2025	JAN	Indigo	Estacionamento	R$ 19,00	Pago
27/12/2025	JAN	PET CAMP	Pet Shop / Vet	R$ 86,07	Pago
27/12/2025	JAN	COOPERATIVA DE CONSUMO	Supermercado	R$ 2,19	Pago
26/12/2025	JAN	ANUIDADE DIFERENCIADA	Reembolso	R$ 43,75	Pago
26/12/2025	JAN	CASA BAUDUCCO	Moradia	R$ 39,80	Pago
26/12/2025	JAN	ANGELATO	Restaurante	R$ 81,72	Pago
26/12/2025	JAN	EdvaldoRelogios	Serviços	R$ 30,00	Pago
26/12/2025	JAN	STUDIO METROPOLE PRIME LT	Reembolso	R$ 89,00	Pago
`;

const lines = transactionText.trim().split('\n');
let sum = 0;
let details = [];

lines.forEach(line => {
    // Regex to extract amount: R$ XXX,XX. Or - R$ XXX,XX
    // Handle "Reembolso" keyword
    const parts = line.split('\t');
    const description = parts[2] || '';
    const category = parts[3] || '';
    const valueStr = parts[4] || '';

    // Normalize value string
    let value = 0;
    let isNegative = false;

    if (valueStr.includes('-')) {
        isNegative = true;
    }

    const numericStr = valueStr.replace(/[R$\s.-]/g, '').replace(',', '.');
    value = parseFloat(numericStr);

    if (isNegative) {
        value = -value;
    }

    // Check if there are other negative indicators?
    // The user list has "Reembolso" as a category or in description.
    // Let's assume the provided text with "R$" and maybe "-" is the source of truth for the sign.
    // If "Reembolso" is present but no "-", it might be positive in the text but should be negative?
    // Or maybe the user *sees* positive in the list but it *sums* differently?

    // Let's try direct sum first.

    sum += value;
    details.push({ description, category, value });
});

console.log('Total Sum (Direct):', sum.toFixed(2));

// Calculate sum if "Reembolso" category with positive value is treated as negative.
let sumAssumeReembolsoIsNegative = 0;
details.forEach(item => {
    let val = item.value;
    if (val > 0 && (item.category.toLowerCase().includes('reembolso') || item.description.toLowerCase().includes('reembolso'))) {
        val = -val;
    }
    sumAssumeReembolsoIsNegative += val;
});
console.log('Total Sum (Assuming Reembolso implies negative):', sumAssumeReembolsoIsNegative.toFixed(2));

// Calculate sum if "Reembolso" category is IGNORED (value 0).
let sumIgnoreReembolso = 0;
details.forEach(item => {
    let val = item.value;
    if (item.category.toLowerCase().includes('reembolso') || item.description.toLowerCase().includes('reembolso')) {
        // check if it was explicitly negative (already subtracted in normal sum).
        // If it was explicitly negative, and we ignore it, we assume we ADD it back (since we started from 0).
        // Wait, if it's ignored, we just don't add 
        val = 0;
    }
    sumIgnoreReembolso += val;
});
console.log('Total Sum (Ignoring Reembolso items):', sumIgnoreReembolso.toFixed(2));



// Id'er i databasen er altid gyldige uuid'er, men ruteparametre kommer fra
// URL'en og kan indeholde hvad som helst. Rammer et vilkårligt id en
// uuid-kolonne, afviser Postgres det med "invalid input syntax for type uuid",
// og app.onError gør alt til en 500. Tjekket gør det til den 404 det bør være.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
    return UUID.test(value);
}

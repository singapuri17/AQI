import urllib.request, json

base = 'http://localhost:8000'
token = json.loads(urllib.request.urlopen(
    urllib.request.Request(base+'/auth/login',
        data=json.dumps({'email':'test@demo.com','password':'pass1234'}).encode(),
        headers={'Content-Type':'application/json'}, method='POST')
).read())['access_token']
H = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

# Get real ward IDs
with urllib.request.urlopen(urllib.request.Request(base+'/aqi/current', headers=H)) as r:
    wards = json.loads(r.read())

print('Real ward_ids in DB:')
for w in wards[:5]:
    print(f'  ward_id={w["ward_id"]}  ward_name={w["ward_name"]}')

# Try generating a report
ward_id = wards[0]['ward_id']
print(f'\nGenerating report for ward_id: {ward_id}')
req = urllib.request.Request(
    base+'/government/reports/generate',
    data=json.dumps({'ward_id': ward_id}).encode(),
    headers=H, method='POST'
)
try:
    with urllib.request.urlopen(req) as r:
        result = json.loads(r.read())
    print('Report OK:', result.get('title'))
    print('ID:', result.get('id'))
    print('PDF path:', result.get('pdf_path'))
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print('ERROR', e.code, ':', body[:500])

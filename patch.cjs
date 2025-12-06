// Disabled patch.cjs
// const fs=require('fs');const path='App.tsx';let t=fs.readFileSync(path,'utf8');const find=`            <BankConnect
// ...
              userId={userId}
              memberId={syncMemberId}
              isSidebar
              onSyncComplete={(count) => {
                if (count > 0) {
                  setActiveTab('table');
                }
              }}
            />`;
const repl=`            <BankConnect
              userId={userId}
              memberId={syncMemberId}
              isSidebar
              onItemConnected={handlePluggyItemConnected}
              onSyncComplete={(count) => {
                if (count > 0) {
                  setActiveTab('table');
                }
              }}
            />`;
if(!t.includes(find)){console.error('pattern not found');process.exit(1);}fs.writeFileSync(path,t.replace(find,repl));

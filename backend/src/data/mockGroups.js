export const MOCK_GROUPS = [
  {
    id: 'g1',
    name: 'Indian Wells 2026 Pool',
    inviteCode: 'INDIAN-WELLS-2026',
    entryFeeCents: 2000,
    prizePoolCents: 1000000,
    tournamentId: 'indian-wells-2026',
    adminUserId: 'u1',
    createdAt: new Date().toISOString()
  },
  {
    id: 'g2',
    name: 'Miami Open 2026 Pool',
    inviteCode: 'MIAMI-2026',
    entryFeeCents: 0,          // Free entry for the Miami launch pool
    prizePoolCents: 0,
    tournamentId: 'miami-2026',
    adminUserId: 'u1',
    createdAt: new Date().toISOString()
  },
];

export const MOCK_USERS = [
  { id: 'u1',  email: 'alice@example.com',   displayName: 'Alice' },
  { id: 'u2',  email: 'bob@example.com',     displayName: 'Bob' },
  { id: 'u3',  email: 'carol@example.com',   displayName: 'Carol' },
  { id: 'u4',  email: 'dan@example.com',     displayName: 'Dan' },
  { id: 'u5',  email: 'emma@example.com',    displayName: 'Emma' },
  { id: 'u6',  email: 'finn@example.com',    displayName: 'Finn' },
  { id: 'u7',  email: 'grace@example.com',   displayName: 'Grace' },
  { id: 'u8',  email: 'harry@example.com',   displayName: 'Harry' },
  { id: 'u9',  email: 'isla@example.com',    displayName: 'Isla' },
  { id: 'u10', email: 'jack@example.com',    displayName: 'Jack' },
  { id: 'u11', email: 'kate@example.com',    displayName: 'Kate' },
  { id: 'u12', email: 'liam@example.com',    displayName: 'Liam' },
  { id: 'u13', email: 'mia@example.com',     displayName: 'Mia' },
  { id: 'u14', email: 'noah@example.com',    displayName: 'Noah' },
  { id: 'u15', email: 'olivia@example.com',  displayName: 'Olivia' },
  { id: 'u16', email: 'pete@example.com',    displayName: 'Pete' },
  { id: 'u17', email: 'quinn@example.com',   displayName: 'Quinn' },
  { id: 'u18', email: 'rosa@example.com',    displayName: 'Rosa' },
  { id: 'u19', email: 'sam@example.com',     displayName: 'Sam' },
  { id: 'u20', email: 'tara@example.com',    displayName: 'Tara' },
  { id: 'u21', email: 'umar@example.com',    displayName: 'Umar' },
  { id: 'u22', email: 'vera@example.com',    displayName: 'Vera' },
  { id: 'u23', email: 'will@example.com',    displayName: 'Will' },
  { id: 'u24', email: 'xena@example.com',    displayName: 'Xena' },
  { id: 'u25', email: 'yusuf@example.com',   displayName: 'Yusuf' },
  { id: 'u26', email: 'zoe@example.com',     displayName: 'Zoe' },
  { id: 'u27', email: 'adam@example.com',    displayName: 'Adam' },
  { id: 'u28', email: 'beth@example.com',    displayName: 'Beth' },
  { id: 'u29', email: 'cole@example.com',    displayName: 'Cole' },
  { id: 'u30', email: 'demi@example.com',    displayName: 'Demi' },
  { id: 'u31', email: 'evan@example.com',    displayName: 'Evan' },
  { id: 'u32', email: 'faye@example.com',    displayName: 'Faye' },
  { id: 'u33', email: 'glen@example.com',    displayName: 'Glen' },
  { id: 'u34', email: 'hana@example.com',    displayName: 'Hana' },
  { id: 'u35', email: 'ivan@example.com',    displayName: 'Ivan' },
  { id: 'u36', email: 'jade@example.com',    displayName: 'Jade' },
  { id: 'u37', email: 'kian@example.com',    displayName: 'Kian' },
  { id: 'u38', email: 'luna@example.com',    displayName: 'Luna' },
  { id: 'u39', email: 'max@example.com',     displayName: 'Max' },
  { id: 'u40', email: 'nina@example.com',    displayName: 'Nina' },
  { id: 'u41', email: 'omar@example.com',    displayName: 'Omar' },
  { id: 'u42', email: 'pia@example.com',     displayName: 'Pia' },
  { id: 'u43', email: 'ravi@example.com',    displayName: 'Ravi' },
  { id: 'u44', email: 'sky@example.com',     displayName: 'Sky' },
  { id: 'u45', email: 'theo@example.com',    displayName: 'Theo' },
  { id: 'u46', email: 'uma@example.com',     displayName: 'Uma' },
  { id: 'u47', email: 'vito@example.com',    displayName: 'Vito' },
  { id: 'u48', email: 'wren@example.com',    displayName: 'Wren' },
  { id: 'u49', email: 'xavi@example.com',    displayName: 'Xavi' },
  { id: 'u50', email: 'yara@example.com',    displayName: 'Yara' },
];

export const MOCK_MEMBERS = [
  // ── Winner ──────────────────────────────────────────────────────────────────
  { id: 'mem40', groupId: 'g1', userId: 'u40', displayName: 'Nina',   isAlive: true,  eliminatedRound: null },

  // ── Eliminated in SF ────────────────────────────────────────────────────────
  { id: 'mem18', groupId: 'g1', userId: 'u18', displayName: 'Rosa',   isAlive: false, eliminatedRound: 'SF' },
  { id: 'mem19', groupId: 'g1', userId: 'u19', displayName: 'Sam',    isAlive: false, eliminatedRound: 'SF' },
  { id: 'mem20', groupId: 'g1', userId: 'u20', displayName: 'Tara',   isAlive: false, eliminatedRound: 'SF' },
  { id: 'mem21', groupId: 'g1', userId: 'u21', displayName: 'Umar',   isAlive: false, eliminatedRound: 'SF' },
  { id: 'mem22', groupId: 'g1', userId: 'u22', displayName: 'Vera',   isAlive: false, eliminatedRound: 'SF' },
  { id: 'mem23', groupId: 'g1', userId: 'u23', displayName: 'Will',   isAlive: false, eliminatedRound: 'SF' },
  { id: 'mem24', groupId: 'g1', userId: 'u24', displayName: 'Xena',   isAlive: false, eliminatedRound: 'SF' },
  { id: 'mem25', groupId: 'g1', userId: 'u25', displayName: 'Yusuf',  isAlive: false, eliminatedRound: 'SF' },
  { id: 'mem26', groupId: 'g1', userId: 'u26', displayName: 'Zoe',    isAlive: false, eliminatedRound: 'SF' },

  // ── Eliminated in QF ────────────────────────────────────────────────────────
  { id: 'mem9',  groupId: 'g1', userId: 'u9',  displayName: 'Isla',   isAlive: false, eliminatedRound: 'QF' },
  { id: 'mem10', groupId: 'g1', userId: 'u10', displayName: 'Jack',   isAlive: false, eliminatedRound: 'QF' },
  { id: 'mem11', groupId: 'g1', userId: 'u11', displayName: 'Kate',   isAlive: false, eliminatedRound: 'QF' },
  { id: 'mem12', groupId: 'g1', userId: 'u12', displayName: 'Liam',   isAlive: false, eliminatedRound: 'QF' },
  { id: 'mem13', groupId: 'g1', userId: 'u13', displayName: 'Mia',    isAlive: false, eliminatedRound: 'QF' },
  { id: 'mem14', groupId: 'g1', userId: 'u14', displayName: 'Noah',   isAlive: false, eliminatedRound: 'QF' },
  { id: 'mem15', groupId: 'g1', userId: 'u15', displayName: 'Olivia', isAlive: false, eliminatedRound: 'QF' },
  { id: 'mem16', groupId: 'g1', userId: 'u16', displayName: 'Pete',   isAlive: false, eliminatedRound: 'QF' },
  { id: 'mem17', groupId: 'g1', userId: 'u17', displayName: 'Quinn',  isAlive: false, eliminatedRound: 'QF' },

  // ── Eliminated in R16 ───────────────────────────────────────────────────────
  { id: 'mem44', groupId: 'g1', userId: 'u44', displayName: 'Sky',    isAlive: false, eliminatedRound: 'R16' },
  { id: 'mem45', groupId: 'g1', userId: 'u45', displayName: 'Theo',   isAlive: false, eliminatedRound: 'R16' },
  { id: 'mem46', groupId: 'g1', userId: 'u46', displayName: 'Uma',    isAlive: false, eliminatedRound: 'R16' },
  { id: 'mem1',  groupId: 'g1', userId: 'u1',  displayName: 'Alice',  isAlive: false, eliminatedRound: 'R16' },
  { id: 'mem2',  groupId: 'g1', userId: 'u2',  displayName: 'Bob',    isAlive: false, eliminatedRound: 'R16' },
  { id: 'mem4',  groupId: 'g1', userId: 'u4',  displayName: 'Dan',    isAlive: false, eliminatedRound: 'R16' },
  { id: 'mem5',  groupId: 'g1', userId: 'u5',  displayName: 'Emma',   isAlive: false, eliminatedRound: 'R16' },
  { id: 'mem6',  groupId: 'g1', userId: 'u6',  displayName: 'Finn',   isAlive: false, eliminatedRound: 'R16' },
  { id: 'mem7',  groupId: 'g1', userId: 'u7',  displayName: 'Grace',  isAlive: false, eliminatedRound: 'R16' },
  { id: 'mem8',  groupId: 'g1', userId: 'u8',  displayName: 'Harry',  isAlive: false, eliminatedRound: 'R16' },

  // ── Eliminated in R32 ───────────────────────────────────────────────────────
  { id: 'mem27', groupId: 'g1', userId: 'u27', displayName: 'Adam',   isAlive: false, eliminatedRound: 'R32' },
  { id: 'mem28', groupId: 'g1', userId: 'u28', displayName: 'Beth',   isAlive: false, eliminatedRound: 'R32' },
  { id: 'mem29', groupId: 'g1', userId: 'u29', displayName: 'Cole',   isAlive: false, eliminatedRound: 'R32' },
  { id: 'mem30', groupId: 'g1', userId: 'u30', displayName: 'Demi',   isAlive: false, eliminatedRound: 'R32' },
  { id: 'mem31', groupId: 'g1', userId: 'u31', displayName: 'Evan',   isAlive: false, eliminatedRound: 'R32' },
  { id: 'mem34', groupId: 'g1', userId: 'u34', displayName: 'Hana',   isAlive: false, eliminatedRound: 'R32' },
  { id: 'mem36', groupId: 'g1', userId: 'u36', displayName: 'Jade',   isAlive: false, eliminatedRound: 'R32' },
  { id: 'mem41', groupId: 'g1', userId: 'u41', displayName: 'Omar',   isAlive: false, eliminatedRound: 'R32' },
  { id: 'mem42', groupId: 'g1', userId: 'u42', displayName: 'Pia',    isAlive: false, eliminatedRound: 'R32' },
  { id: 'mem43', groupId: 'g1', userId: 'u43', displayName: 'Ravi',   isAlive: false, eliminatedRound: 'R32' },

  // ── Eliminated in R64 ───────────────────────────────────────────────────────
  { id: 'mem3',  groupId: 'g1', userId: 'u3',  displayName: 'Carol',  isAlive: false, eliminatedRound: 'R64' },
  { id: 'mem47', groupId: 'g1', userId: 'u47', displayName: 'Vito',   isAlive: false, eliminatedRound: 'R64' },
  { id: 'mem48', groupId: 'g1', userId: 'u48', displayName: 'Wren',   isAlive: false, eliminatedRound: 'R64' },
  { id: 'mem32', groupId: 'g1', userId: 'u32', displayName: 'Faye',   isAlive: false, eliminatedRound: 'R64' },
  { id: 'mem35', groupId: 'g1', userId: 'u35', displayName: 'Ivan',   isAlive: false, eliminatedRound: 'R64' },
  { id: 'mem37', groupId: 'g1', userId: 'u37', displayName: 'Kian',   isAlive: false, eliminatedRound: 'R64' },
  { id: 'mem38', groupId: 'g1', userId: 'u38', displayName: 'Luna',   isAlive: false, eliminatedRound: 'R64' },
  { id: 'mem39', groupId: 'g1', userId: 'u39', displayName: 'Max',    isAlive: false, eliminatedRound: 'R64' },

  // ── Eliminated in R1 ────────────────────────────────────────────────────────
  { id: 'mem49', groupId: 'g1', userId: 'u49', displayName: 'Xavi',   isAlive: false, eliminatedRound: 'R1' },
  { id: 'mem50', groupId: 'g1', userId: 'u50', displayName: 'Yara',   isAlive: false, eliminatedRound: 'R1' },
  { id: 'mem33', groupId: 'g1', userId: 'u33', displayName: 'Glen',   isAlive: false, eliminatedRound: 'R1' },
];

export const MOCK_PICKS = [
  // User u1 (current default user) picks
  { id: 'pick1', groupId: 'g1', userId: 'u1', round: 'R1', playerId: 'michelsen-r1', playerName: 'Michelsen', survived: true },
  { id: 'pick2', groupId: 'g1', userId: 'u1', round: 'R64', playerId: 'learner-tien-r64', playerName: 'Learner Tien', survived: true },
  { id: 'pick3', groupId: 'g1', userId: 'u2', round: 'R1', playerId: 'p3', playerName: 'Novak Djokovic', survived: true },
  { id: 'pick4', groupId: 'g1', userId: 'u2', round: 'R64', playerId: 'p5', playerName: 'Alexander Zverev', survived: true },
  { id: 'pick5', groupId: 'g1', userId: 'u3', round: 'R1', playerId: 'p4', playerName: 'Daniil Medvedev', survived: true },
  { id: 'pick6', groupId: 'g1', userId: 'u3', round: 'R64', playerId: 'p10', playerName: 'Stefanos Tsitsipas', survived: false }
];

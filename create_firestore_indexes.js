// 此脚本生成 Firestore 复合索引的 Firebase CLI 命令
// 需要在 Firebase 控制台手动创建，或使用 Firebase CLI

const indexes = [
  {
    collectionGroup: "transactions",
    queryScope: "COLLECTION",
    fields: [
      { fieldPath: "userId", order: "ASCENDING" },
      { fieldPath: "yearMonth", order: "ASCENDING" },
      { fieldPath: "createdAt", order: "ASCENDING" }
    ]
  },
  {
    collectionGroup: "transactions",
    queryScope: "COLLECTION",
    fields: [
      { fieldPath: "userId", order: "ASCENDING" },
      { fieldPath: "yearMonth", order: "ASCENDING" },
      { fieldPath: "createdAt", order: "DESCENDING" }
    ]
  }
];

console.log("请在 Firebase 控制台创建以下复合索引：");
console.log("");
console.log("索引 1 (asc):");
console.log("  Collection: transactions");
console.log("  Fields: userId (Asc), yearMonth (Asc), createdAt (Asc)");
console.log("");
console.log("索引 2 (desc):");
console.log("  Collection: transactions");
console.log("  Fields: userId (Asc), yearMonth (Asc), createdAt (Desc)");
console.log("");
console.log("控制台链接：");
console.log("https://console.firebase.google.com/project/telegram-bot-new-cef53/firestore/indexes");

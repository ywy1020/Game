# 多人塗色對戰遊戲規格說明

## 專案概述
這是一個基於網頁的多人塗色對戰遊戲，使用純前端技術實現。玩家可以創建或加入房間，在畫布上進行即時塗色對戰。

## 技術架構
- 前端：純 HTML、CSS 和 JavaScript
- 資料庫：GUN.js（去中心化資料庫，使用 CDN 版本）
- 不使用 npm 套件，所有依賴都通過 CDN 載入

### 外部依賴
```html
<script src="https://cdn.jsdelivr.net/npm/gun/gun.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gun/sea.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gun/lib/webrtc.js"></script>
```

## 核心功能

### 1. 房間系統
#### 創建房間
- 自動生成 6 位數房間代碼
- 創建者自動成為房主
- 初始化房間狀態（waiting/playing）

#### 加入房間
- 通過房間代碼加入
- 驗證房間存在性和狀態
- 房間人數上限為 8 人
- 房間有效期為 30 分鐘

#### 等待室功能
- 顯示當前房間代碼
- 顯示在線玩家列表及人數
- 房主專屬開始遊戲按鈕
- 玩家可以離開房間

### 2. 玩家管理
#### 玩家資料結構
```javascript
{
    id: string,          // 隨機生成的玩家ID
    nickname: string,    // 玩家暱稱
    isHost: boolean,     // 是否為房主
    lastSeen: number,    // 最後在線時間戳
    team: number         // 隊伍編號（0-3）
}
```

#### 在線狀態管理
- 每 3 秒更新一次在線狀態
- 超過 10 秒未更新視為離線
- 自動清理離線玩家

### 3. 遊戲機制
#### 遊戲設定
- 遊戲時間：60 秒
- 4 個隊伍（紅、綠、藍、黃）
- 玩家自動平均分配到各隊伍

#### 塗色系統
- 使用空白鍵在滑鼠位置塗色
- 不規則油漆效果（隨機大小和形狀）
- 可以覆蓋其他顏色
- 即時同步到所有玩家

#### 計分系統
- 計算每個隊伍的塗色面積
- 統計個人塗色次數
- 遊戲結束時顯示團隊排名
- 顯示個人 MVP 排行（前三名）

## 資料結構

### GUN.js 資料模型
```javascript
rooms: {
    [roomCode]: {
        host: string,        // 房主ID
        status: string,      // 房間狀態
        createdAt: number,   // 創建時間戳
        players: {
            [playerId]: {
                id: string,
                nickname: string,
                isHost: boolean,
                lastSeen: number
            }
        },
        splatters: [         // 塗色記錄
            {
                x: number,
                y: number,
                team: number,
                color: string,
                playerId: string,
                timestamp: number
            }
        ]
    }
}
```

## 介面結構

### 畫面
1. 首頁（homeScreen）
   - 暱稱輸入
   - 創建/加入房間按鈕

2. 加入房間頁面（joinRoomScreen）
   - 房間代碼輸入
   - 確認/返回按鈕

3. 等待室（waitingScreen）
   - 房間資訊
   - 玩家列表
   - 開始遊戲按鈕（僅房主可見）

4. 遊戲畫面（gameScreen）
   - 遊戲畫布
   - 隊伍資訊
   - 剩餘時間
   - 即時分數

5. 結算畫面（resultScreen）
   - 團隊排名
   - MVP 榜
   - 重新開始/返回按鈕

## 開發注意事項

### 連線處理
- 使用多個 GUN.js 伺服器備援
- 顯示連線狀態提示
- 處理斷線重連
- 確保資料同步穩定性

### 效能優化
- 限制油漆特效複雜度
- 定期清理過期資料
- 優化畫布渲染
- 控制資料同步頻率

### 錯誤處理
- 房間代碼驗證
- 連線超時處理
- 玩家異常離線處理
- 遊戲狀態異常處理

## 未來可能的擴充功能
1. 自訂遊戲時間
2. 更多隊伍顏色選擇
3. 不同的遊戲模式
4. 聊天系統
5. 道具系統
6. 排行榜系統
7. 自訂房間設定
8. 觀戰模式
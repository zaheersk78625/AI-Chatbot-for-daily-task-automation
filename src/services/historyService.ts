/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  limit
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { ChatMessage, OperationType, FirestoreErrorInfo } from '../types';

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('History Error: ', JSON.stringify(errInfo));
}

export const historyService = {
  async saveMessage(role: 'user' | 'model', content: string) {
    if (!auth.currentUser) return;
    try {
      await addDoc(collection(db, 'chat_history'), {
        role,
        content,
        userId: auth.currentUser.uid,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chat_history');
    }
  },

  subscribeToHistory(callback: (messages: ChatMessage[]) => void) {
    if (!auth.currentUser) return () => {};
    const q = query(
      collection(db, 'chat_history'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('timestamp', 'asc'),
      limit(50)
    );

    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
      callback(messages);
    });
  }
};

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface HipatiaConversation {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HipatiaMessage {
  id: string;
  content: string;
  role: 'USER' | 'ASSISTANT' | 'TOOL';
  createdAt: string;
}

export interface HipatiaMessageDto {
  conversationId?: string;
  message: string;
}

export interface HipatiaReply {
  conversationId: string;
  hasDataChanges: boolean;
  reply: string;
}

export interface HipatiaMemory {
  id: string;
  category: string | null;
  content: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class HipatiaApiService {
  private readonly http = inject(HttpClient);

  public chat(body: HipatiaMessageDto): Observable<HipatiaReply> {
    return this.http.post<HipatiaReply>('/api/v1/hipatia/chat', body);
  }

  public getConversations(): Observable<HipatiaConversation[]> {
    return this.http.get<HipatiaConversation[]>(
      '/api/v1/hipatia/conversations'
    );
  }

  public getMessages(conversationId: string): Observable<HipatiaMessage[]> {
    return this.http.get<HipatiaMessage[]>(
      `/api/v1/hipatia/conversations/${conversationId}/messages`
    );
  }

  public deleteConversation(conversationId: string): Observable<void> {
    return this.http.delete<void>(
      `/api/v1/hipatia/conversations/${conversationId}`
    );
  }

  public getMemories(): Observable<HipatiaMemory[]> {
    return this.http.get<HipatiaMemory[]>('/api/v1/hipatia/memories');
  }

  public deleteMemory(memoryId: string): Observable<void> {
    return this.http.delete<void>(`/api/v1/hipatia/memories/${memoryId}`);
  }
}

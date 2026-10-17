import * as React from "react"
import { db } from "@/db"
import { contactMessages } from "@/db/schema"
import { desc } from "drizzle-orm"
import {
  MessagesClient,
  ContactMessageData,
} from "@/components/admin/catalog/messages-client"

export const metadata = {
  title: "Contact Messages Inbox | Al Ramlah Travels Admin",
}

export default async function AdminMessagesPage() {
  const allMessages = await db
    .select()
    .from(contactMessages)
    .orderBy(desc(contactMessages.createdAt))

  return (
    <MessagesClient
      initialMessages={allMessages as unknown as ContactMessageData[]}
    />
  )
}

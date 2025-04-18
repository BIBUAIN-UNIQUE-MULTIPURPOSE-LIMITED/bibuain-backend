import { Response, NextFunction } from "express";
import dbConnect from "../config/database";
import { Message } from "../models/messages";
import { User } from "../models/user";
import { Chat } from "../models/chats";
import ErrorHandler from "../utils/errorHandler";
import { UserRequest } from "middlewares/authenticate";

// Create a new message
export const createMessage = async (
  req: UserRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { chatId, content } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      throw new ErrorHandler("Unauthorized access", 401);
    }

    const chatRepo = dbConnect.getRepository(Chat);
    const messageRepo = dbConnect.getRepository(Message);

    // Find the chat
    const chat = await chatRepo.findOne({
      where: { id: chatId },
      relations: ["participants"],
    });
    if (!chat) {
      throw new ErrorHandler("Chat not found", 404);
    }

    // Find the sender (user)
    const sender = await dbConnect.getRepository(User).findOne({ where: { id: userId } });
    if (!sender) {
      throw new ErrorHandler("User not found", 404);
    }

    // Create a new message
    const message = new Message();
    message.chat = chat;
    message.sender = sender;
    message.content = content;
    message.seen = false;

    const attachments: Array<{
      url: string;
      type: string;
      name: string;
      size: number;
    }> = [];

    if (req.file) {
      attachments.push({
        url: `/uploads/${req.file.filename}`,
        type: req.file.mimetype,
        name: req.file.originalname,
        size: req.file.size,
      });
    }
    console.log(attachments);
    if (attachments.length > 0) {
      message.attachments = attachments;
    }

    const savedMessage = await messageRepo.save(message);

    req.app.get("io").to(chatId).emit("newMessage", savedMessage);

    res.json({
      success: true,
      message: "Message sent successfully",
      data: savedMessage,
    });
  } catch (error) {
    next(error);
  }
};

// Mark a message as seen by the user
export const markMessageAsSeen = async (
  req: UserRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { messageId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new ErrorHandler("Unauthorized access", 401);
    }

    const messageRepo = dbConnect.getRepository(Message);
    const userRepo = dbConnect.getRepository(User);

    // Find the message
    const message = await messageRepo.findOne({
      where: { id: messageId },
      relations: ["seenBy", "chat", "chat.participants"],
    });

    if (!message) {
      throw new ErrorHandler("Message not found", 404);
    }

    // Find the user
    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new ErrorHandler("User not found", 404);
    }

    // Save the updated message
    const updatedMessage = await messageRepo.save(message);

    res.json({
      success: true,
      message: "Message marked as seen successfully",
      data: updatedMessage,
    });
  } catch (error) {
    next(error);
  }
};

// Get all messages in a chat
export const getMessagesInChat = async (
  req: UserRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { chatId } = req.params;

    const messageRepo = dbConnect.getRepository(Message);

    // Find all messages in the given chat
    const messages = await messageRepo.find({
      where: { chat: { id: chatId } },
      order: { createdAt: "ASC" },
      relations: ["sender", "seenBy"],
    });

    if (!messages.length) {
      throw new ErrorHandler("No messages found", 404);
    }

    res.json({
      success: true,
      data: messages,
    });
  } catch (error) {
    next(error);
  }
};

// Get unseen messages for a specific user in a chat
export const getUnseenMessages = async (
  req: UserRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { chatId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new ErrorHandler("Unauthorized access", 401);
    }

    const messageRepo = dbConnect.getRepository(Message);

    // Find messages that have not been seen by the user
    const unseenMessages = await messageRepo
      .createQueryBuilder("message")
      .leftJoinAndSelect("message.sender", "sender")
      .leftJoinAndSelect("message.seenBy", "seenBy")
      .where("message.chatId = :chatId", { chatId })
      .andWhere(
        "NOT EXISTS (SELECT 1 FROM message_seen_by WHERE message_id = message.id AND user_id = :userId)",
        { userId }
      )
      .orderBy("message.createdAt", "ASC")
      .getMany();

    if (!unseenMessages) {
      throw new ErrorHandler("No unseen messages found", 404);
    }

    res.json({
      success: true,
      data: unseenMessages,
    });
  } catch (error) {
    next(error);
  }
};

// Get the details of a specific message
export const getMessageDetails = async (
  req: UserRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { messageId } = req.params;

    const messageRepo = dbConnect.getRepository(Message);

    // Find the message by its ID
    const message = await messageRepo.findOne({
      where: { id: messageId },
      relations: ["sender", "seenBy", "chat"],
    });

    if (!message) {
      throw new ErrorHandler("Message not found", 404);
    }

    res.json({
      success: true,
      data: message,
    });
  } catch (error) {
    next(error);
  }
};

// Delete a message
export const deleteMessage = async (
  req: UserRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { messageId } = req.params;

    const messageRepo = dbConnect.getRepository(Message);

    // Find the message to be deleted
    const message = await messageRepo.findOne({ where: { id: messageId } });

    if (!message) {
      throw new ErrorHandler("Message not found", 404);
    }

    // Delete the message
    await messageRepo.remove(message);

    res.json({
      success: true,
      message: "Message deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Get All Messages for a specific Chat
export const getMessages = async (
  req: UserRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { chatId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new ErrorHandler("Unauthorized access", 401);
    }

    const chatRepo = dbConnect.getRepository(Chat);
    const messageRepo = dbConnect.getRepository(Message);

    const chat = await chatRepo.findOne({
      where: { id: chatId },
      relations: ["participants"],
    });

    if (!chat) {
      throw new ErrorHandler("Chat not found", 404);
    }

    if (!chat.participants.some((user) => user.id === userId)) {
      throw new ErrorHandler("You are not a participant of this chat", 403);
    }

    const messages = await messageRepo.find({
      where: { chat: { id: chatId } },
      order: { createdAt: "ASC" },
    });

    res.json({
      success: true,
      data: messages,
    });
  } catch (error) {
    next(error);
  }
};

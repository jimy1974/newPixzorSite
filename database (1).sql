-- MySQL dump 10.13  Distrib 8.0.32, for Win64 (x86_64)
--
-- Host: localhost    Database: pixzorai
-- ------------------------------------------------------
-- Server version	8.0.31

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `images`
--

DROP TABLE IF EXISTS `images`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `images` (
  `id` int NOT NULL AUTO_INCREMENT,
  `imageUrl` varchar(255) NOT NULL,
  `prompt` text,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `userId` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `userId` (`userId`),
  CONSTRAINT `images_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `images`
--

LOCK TABLES `images` WRITE;
/*!40000 ALTER TABLE `images` DISABLE KEYS */;
/*!40000 ALTER TABLE `images` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `personalimages`
--

DROP TABLE IF EXISTS `personalimages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `personalimages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int DEFAULT NULL,
  `imageUrl` varchar(255) NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `description` text,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `prompt` text,
  PRIMARY KEY (`id`),
  KEY `userId` (`userId`),
  CONSTRAINT `personalimages_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `personalimages`
--

LOCK TABLES `personalimages` WRITE;
/*!40000 ALTER TABLE `personalimages` DISABLE KEYS */;
INSERT INTO `personalimages` VALUES (1,7,'/personal-images/7/image_1731950313459.jpg',NULL,NULL,'2024-11-18 17:18:33','2024-11-18 17:18:33','A robot woman dancing in a spaceship.'),(2,7,'/personal-images/7/image_1731957187180.jpg',NULL,NULL,'2024-11-18 19:13:07','2024-11-18 19:13:07','A lively golden retriever puppy joyfully frolicking through a vibrant field of colorful flowers under the warm glow of natural light. This masterpiece features exquisite detail and realism, captured in the highest quality 8K UHD resolution for an amazing viewing experience. The fine details and textures of the scene are beautifully preserved in this raw photo, showcasing the beauty of nature in its purest form.'),(3,7,'/personal-images/7/image_1731958488108.jpg',NULL,NULL,'2024-11-18 19:34:48','2024-11-18 19:34:48','A formidable dwarven commander from Dungeons and Dragons leading his army through winding underground corridors in preparation for an epic battle. The scene is filled with tension and anticipation as the group navigates the dark, treacherous passageways, their armor glinting in the dim light. The commander\'s strategic prowess and unwavering determination are evident, setting the stage for a thrilling adventure in the depths of the earth.'),(4,7,'/personal-images/7/image_1731960555331.jpg',NULL,NULL,'2024-11-18 20:09:15','2024-11-18 20:09:15','An ethereal figure of elegance gazes gracefully towards a tranquil waterfall, framed by cascading strands of hair intricately braided to resemble the flowing waters. Her pointed ears peek out from beneath the veil of hair, adding a touch of mystique to her enchanting presence. Soft, ambient lighting highlights the contours of her slender form, enhancing the delicate features of her face with a serene glow. The vibrant colors and detailed rendering of the scene evoke a sense of mesmerizing beauty, reminiscent of a cyberpunk anime painting'),(5,7,'/personal-images/7/image_1731961769993.jpg',NULL,NULL,'2024-11-18 20:29:29','2024-11-18 20:29:29','Vivid and captivating landscape, Surreal and imaginative, A futuristic world where robotic creatures roam freely, Giant metallic spider weaving its web between neon skyscrapers, Glowing orbs floating in the sky, Distant figure of a mysterious cyborg watching from a rooftop, Intricate details and vibrant colors.'),(6,7,'/personal-images/7/image_1731962080187.jpg',NULL,NULL,'2024-11-18 20:34:40','2024-11-18 20:34:40','Stunning, highly detailed, and atmospheric fantasy artwork. A majestic black dragon lies dormant, its scales glistening in the faint moonlight, as the elven queen reclines upon its back. The dragon\'s wings are folded, its claws gripping the mist-shrouded banks of a serene, silver-lit lake. The elven queen, resplendent in intricate, gemstone-encrusted armor, rests her crowned head against the dragon\'s neck, her raven hair cascading down its scales like a waterfall of night. Her eyes are closed, a look of peaceful slumber on her ethereal face, as if she and the dragon are one being, connected in a deep, mystical sleep. The atmosphere is tranquil, yet powerful, as if the very fate of the realm hangs in the balance of this magical, symbiotic bond.'),(7,7,'/personal-images/7/image_1731965638634.jpg',NULL,NULL,'2024-11-18 21:33:58','2024-11-18 21:33:58','Vibrant, hyper-realistic portrait of a mystical maiden, bathed in the soft, warm glow of candlelight. Her porcelain skin seems to radiate a gentle luminescence, as if infused with the essence of moonflowers. Adorned with intricate, gemstone-encrusted headdress and choker, reminiscent of ancient, mystical artifacts, she exudes an aura of regal, otherworldly elegance. Her sapphire eyes, pools of deep, shimmering blue, seem to hold the secrets of the cosmos, as if gazing into the very soul of the viewer. Capture her in a moment of reverie, lost in thought, her delicate fingers absently tracing the curves of a rare, exotic bloom. Employ a shallow depth of field to blur the background, evoking a dreamlike, impressionist quality, as if the maiden exists in a realm beyond the mundane, where magic and reality blend. The overall atmosphere should be one of enchantment, mystery, and subtle, mystical power.'),(8,7,'/personal-images/7/image_1731965723705.jpg',NULL,NULL,'2024-11-18 21:35:23','2024-11-18 21:35:23','A ravishing, ethereal siren stands poised at the edge of a shimmering, iridescent pool, surrounded by a lush, cybernetic oasis. Her raven tresses are styled in an intricate, neon-lit hairpiece that resembles a halo, with tendrils of silver and gold that seem to merge with the circuitry of her skin. The soft, pulsing glow of the pool\'s waters highlights the porcelain perfection of her complexion, and the athletic contours of her physique, as if she is a living, breathing embodiment of the futuristic landscape. Her eyes burn with an inner intensity, like stars in the darkness, as she gazes out upon the cityscape that stretches out beyond the oasis, a tapestry of towering skyscrapers and holographic advertisements. The atmosphere is one of mesmerizing, high-tech allure, as if the siren is a gateway to a world of virtual reality and limitless possibility. Employ vibrant, neon colors and intricate, futuristic details to bring this cyberpunk dreamscape to life.'),(9,7,'/personal-images/7/image_1731965894433.jpg',NULL,NULL,'2024-11-18 21:38:14','2024-11-18 21:38:14','Create a stunning 8K wallpaper of Rebecca, a vibrant and youthful woman with a curvy hourglass figure. Capture her in a full-body shot, using natural light and photon mapping to highlight her features. She has fiery red hair, luminous porcelain-like skin, and bright crystal blue eyes. Her toned physique is well-defined, with chiseled abs and a naturally arched back. She wears a bold, red mesh outfit with an open-sleeve bolero and lace-up maxi-skirt, complete with elegant piercings and long, ruby-red nails. Showcase her playful energy and unique style in a striking, provocative portrait that balances sensuality and intrigue.'),(10,7,'/personal-images/7/image_1731966315820.jpg',NULL,NULL,'2024-11-18 21:45:15','2024-11-18 21:45:15','Full body view, sexy, stunning 8K wallpaper of a vibrant and youthful woman with a curvy hourglass figure. Capture her in a full-body shot, using natural light and photon mapping to highlight her features. She has fiery red hair, luminous porcelain-like skin, and bright crystal blue eyes. Her toned physique is well-defined, with chiseled abs and a naturally arched back. She wears a bold, red mesh outfit with an open-sleeve bolero and lace-up maxi-skirt, complete with elegant piercings and long, ruby-red nails. Showcase her playful energy and unique style in a striking, provocative portrait that balances sensuality and intrigue.');
/*!40000 ALTER TABLE `personalimages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `publicimages`
--

DROP TABLE IF EXISTS `publicimages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `publicimages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `imageUrl` varchar(255) NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `description` text,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `publicimages`
--

LOCK TABLES `publicimages` WRITE;
/*!40000 ALTER TABLE `publicimages` DISABLE KEYS */;
INSERT INTO `PublicImages` VALUES (1,'/public-images/image1.jpg','Beach Day','A beautiful girl with Waves crashing on a sunny beach.','2024-11-17 23:42:07','2024-11-17 23:42:07'),(2,'/public-images/image2.jpg','City Lights','A stunning cityscape at night.','2024-11-17 23:42:07','2024-11-17 23:42:07'),(3,'/public-images/image3.jpg','Beach Day','Waves crashing on a sunny beach.','2024-11-17 23:42:07','2024-11-17 23:42:07'),(4,'/public-images/image4.jpg','Beach Day','A beautiful girl with Waves crashing on a sunny beach.','2024-11-17 23:42:07','2024-11-17 23:42:07'),(5,'/public-images/image5.jpg','City Lights','A stunning cityscape at night.','2024-11-17 23:42:07','2024-11-17 23:42:07'),(6,'/public-images/image6.jpg','Beach Day','Waves crashing on a sunny beach.','2024-11-17 23:42:07','2024-11-17 23:42:07'),(7,'/public-images/image7.jpg','Beach Day','A beautiful girl with Waves crashing on a sunny beach.','2024-11-17 23:42:07','2024-11-17 23:42:07'),(8,'/public-images/image8.jpg','City Lights','A stunning cityscape at night.','2024-11-17 23:42:07','2024-11-17 23:42:07'),(9,'/public-images/image9.jpg','Beach Day','Waves crashing on a sunny beach.','2024-11-17 23:42:07','2024-11-17 23:42:07'),(10,'/public-images/image10.jpg','Beach Day','Waves crashing on a sunny beach.','2024-11-17 23:42:07','2024-11-17 23:42:07');
/*!40000 ALTER TABLE `publicimages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) DEFAULT 'default_password',
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `googleId` varchar(255) DEFAULT NULL,
  `tokens` int DEFAULT '0',
  `photo` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `googleId` (`googleId`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (7,'Pixzor','jimy.hyland@gmail.com','default_password','2024-11-18 16:19:22','2024-11-18 21:45:15','108769086517871943215',190,'https://lh3.googleusercontent.com/a/ACg8ocIAjnL_7Zqdr8iiaBcuLB7hkCdhlhkcUheL0ZLjDwPy50P5wvef=s96-c');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2024-11-18 23:56:12
